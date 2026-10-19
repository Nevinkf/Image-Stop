import { useAuth } from './AuthContext'
import { api } from './api'
import type { Image } from './types'

type Patch = Pick<Image, 'likedByMe' | 'likeCount'>

// Optimistically flips a like, then syncs with the server (or rolls back on failure).
// `update` applies the change wherever the caller keeps its images.
export function useLikeToggle(update: (id: number, patch: Patch) => void, requireLogin: () => void) {
  const { user } = useAuth()

  return async function toggleLike(image: Image) {
    if (!user) {
      requireLogin()
      return
    }
    const liked = !image.likedByMe
    update(image.id, { likedByMe: liked, likeCount: image.likeCount + (liked ? 1 : -1) })
    try {
      const res = await api<Patch>(`/api/images/${image.id}/like`, { method: liked ? 'POST' : 'DELETE' })
      update(image.id, res)
    } catch (err) {
      console.error('Failed to update like', err)
      update(image.id, { likedByMe: image.likedByMe, likeCount: image.likeCount })
    }
  }
}
