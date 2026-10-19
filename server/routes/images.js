import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { signedUrl, uploadObject } from '../s3.js';
import { requireAuth } from '../auth.js';

const router = Router();

const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;
const MAX_QUERY_LENGTH = 100;

function normalizeTag(raw) {
    return raw.trim().replace(/^#+/, '').toLowerCase();
}

// "Sunset, #beach, sunset" -> ['sunset', 'beach']
function parseTags(raw) {
    if (typeof raw !== 'string') return [];
    return [...new Set(raw.split(',').map(normalizeTag).filter(Boolean))];
}

// So a search for "100%" or "a_b" matches literally instead of acting as wildcards
function escapeLike(s) {
    return s.replace(/[\\%_]/g, '\\$&');
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024}, // 10 MB
    fileFilter: (req, file, cb) => cb(null, file.mimetype in ALLOWED_TYPES),
});

// Shared columns for every image listing; $1 is the current user's id (or null)
const IMAGE_SELECT = `
    SELECT i.id, i.title, i.s3_key, i.tags, u.username AS uploader,
           COUNT(l.user_id)::int AS like_count,
           COALESCE(BOOL_OR(l.user_id = $1), false) AS liked_by_me
    FROM images i
    LEFT JOIN users u ON u.id = i.user_id
    LEFT JOIN likes l ON l.image_id = i.id`;

const MAX_RECOMMENDED = 12;

async function toImageJson(r) {
    return {
        id: r.id,
        title: r.title,
        uploader: r.uploader,
        tags: r.tags,
        likeCount: r.like_count,
        likedByMe: r.liked_by_me,
        url: await signedUrl(r.s3_key),
    };
}

router.get('/', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, MAX_QUERY_LENGTH) : '';
    const tag = typeof req.query.tag === 'string' ? normalizeTag(req.query.tag) : '';
    try {
        const { rows } = await pool.query(`${IMAGE_SELECT}
            WHERE ($2::text IS NULL
                   OR i.title ILIKE $2
                   OR u.username ILIKE $2
                   OR EXISTS (SELECT 1 FROM unnest(i.tags) AS t WHERE t ILIKE $2))
              AND ($3::text IS NULL OR i.tags @> ARRAY[$3::text])
            GROUP BY i.id, u.username
            ORDER BY i.created_at DESC`,
            [req.session.userId ?? null, q ? `%${escapeLike(q)}%` : null, tag || null]
        );
        res.json(await Promise.all(rows.map(toImageJson)));
    } catch (err) {
        console.error('GET /api/images failed:', err);
        res.status(500).json({ error: 'Failed to load images' });
    }
});

router.get('/:id', async (req, res) => {
    const imageId = Number(req.params.id);
    if (!Number.isInteger(imageId)) return res.status(400).json({ error: 'Invalid image id' });
    try {
        const { rows } = await pool.query(`${IMAGE_SELECT}
            WHERE i.id = $2
            GROUP BY i.id, u.username`,
            [req.session.userId ?? null, imageId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Image not found' });
        res.json(await toImageJson(rows[0]));
    } catch (err) {
        console.error(`GET /api/images/${req.params.id} failed:`, err);
        res.status(500).json({ error: 'Failed to load image' });
    }
});

// Other images ranked by tags shared with this one, then popularity, then recency.
// Images with no shared tags still fill the list so there's always something to show.
router.get('/:id/recommended', async (req, res) => {
    const imageId = Number(req.params.id);
    if (!Number.isInteger(imageId)) return res.status(400).json({ error: 'Invalid image id' });
    try {
        const { rows } = await pool.query(`${IMAGE_SELECT}
            CROSS JOIN (SELECT tags FROM images WHERE id = $2) target
            WHERE i.id <> $2
            GROUP BY i.id, u.username, target.tags
            ORDER BY cardinality(ARRAY(SELECT unnest(i.tags) INTERSECT SELECT unnest(target.tags))) DESC,
                     like_count DESC,
                     i.created_at DESC
            LIMIT $3`,
            [req.session.userId ?? null, imageId, MAX_RECOMMENDED]
        );
        res.json(await Promise.all(rows.map(toImageJson)));
    } catch (err) {
        console.error(`GET /api/images/${req.params.id}/recommended failed:`, err);
        res.status(500).json({ error: 'Failed to load recommendations' });
    }
});

// requireAuth runs first so anonymous requests are rejected before the file is buffered
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
    const title = req.body.title?.trim();
    if (!req.file) return res.status(400).json({ error: 'Choose a JPEG, PNG, GIF, or WebP image' });
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const tags = parseTags(req.body.tags);
    if (tags.length > MAX_TAGS) return res.status(400).json({ error: `Use at most ${MAX_TAGS} tags` });
    if (tags.some((t) => t.length > MAX_TAG_LENGTH)) {
        return res.status(400).json({ error: `Tags must be ${MAX_TAG_LENGTH} characters or fewer` });
    }
    
    const key = `uploads/${req.session.userId}/${randomUUID()}${ALLOWED_TYPES[req.file.mimetype]}`;
    try {
        await uploadObject(key, req.file.buffer, req.file.mimetype);
        const { rows } = await pool.query(
            'INSERT INTO images (title, s3_key, user_id, tags) VALUES ($1, $2, $3, $4) RETURNING id',
            [title, key, req.session.userId, tags]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) {
        console.error('POST /api/images failed:', err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

async function setLike(req, res, liked) {
    const imageId = Number(req.params.id);
    if (!Number.isInteger(imageId)) return res.status(400).json({ error: 'Invalid image id' });
    try {
        if (liked) {
            await pool.query(
                'INSERT INTO likes (user_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [req.session.userId, imageId]
            );
        } else {
            await pool.query(
                'DELETE FROM likes WHERE user_id = $1 AND image_id = $2',
                [req.session.userId, imageId]
            );
        }
        const { rows } = await pool.query(
            'SELECT COUNT(*)::int AS count FROM likes WHERE image_id = $1',
            [imageId]
        );
        res.json({ likeCount: rows[0].count, likedByMe: liked });
    } catch (err) {
        if (err.code === '23503') return res.status(404).json({ error: 'Image not found' });
        console.error(`${req.method} /api/images/${req.params.id}/like failed:`, err);
        res.status(500).json({ error: 'Failed to update like' });
    }
}

router.post('/:id/like', requireAuth, (req, res) => setLike(req, res, true));
router.delete('/:id/like', requireAuth, (req, res) => setLike(req, res, false));

export default router;