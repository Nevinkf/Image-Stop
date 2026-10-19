import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'

import { api } from './api'
import { useAuth } from './AuthContext'
import { useLikeToggle } from './useLikeToggle'
import ImageGrid from './ImageGrid'
import TagList from './TagList'
import LikeButton from './LikeButton'
import type { Image } from './types'

type LoadError = 'not-found' | 'error'

function ImageDetail({ requireLogin }: { requireLogin: () => void }) {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [image, setImage] = useState<Image | null>(null)
  const [recommended, setRecommended] = useState<Image[]>([])
  // Remember which id failed so a stale error doesn't linger after navigating to another image
  const [failure, setFailure] = useState<{ id: string | undefined; error: LoadError } | null>(null)
  const error = failure && failure.id === id ? failure.error : null

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // Reload when the user changes too, so likedByMe matches whoever is logged in
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    Promise.all([
      api<Image>(`/api/images/${id}`, { signal }),
      api<Image[]>(`/api/images/${id}/recommended`, { signal }),
    ])
      .then(([img, recs]) => {
        setImage(img)
        setRecommended(recs)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (err.message === 'Image not found' || err.message === 'Invalid image id') {
          setFailure({ id, error: 'not-found' })
        } else {
          console.error('Failed to load image', err)
          setFailure({ id, error: 'error' })
        }
      })
    return () => controller.abort()
  }, [id, user?.id])

  // Likes can come from the main image or a recommendation; update whichever holds it
  const toggleLike = useLikeToggle((imageId, patch) => {
    setImage((img) => (img?.id === imageId ? { ...img, ...patch } : img))
    setRecommended((imgs) => imgs.map((i) => (i.id === imageId ? { ...i, ...patch } : i)))
  }, requireLogin)

  // Go back if we got here from inside the app, otherwise to the gallery
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  if (error) {
    return (
      <div className="py-5 text-center">
        <p className="text-body-secondary">
          {error === 'not-found' ? 'Image not found.' : 'Something went wrong loading this image.'}
        </p>
        <Link to="/">Back to gallery</Link>
      </div>
    )
  }
  // Keep showing the previous image while the next one loads to avoid a flash
  if (!image) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" role="status" />
      </div>
    )
  }

  return (
    <>
      <button type="button" className="btn btn-link px-0 mb-2" onClick={goBack}>
        ← Back
      </button>

      <figure className="detail-figure mb-3">
        <img className="detail-img" src={image.url} alt={image.title} />
      </figure>

      <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="h4 mb-1 text-break">{image.title}</h2>
          {image.uploader && <div className="text-body-secondary">by {image.uploader}</div>}
          <TagList tags={image.tags} />
        </div>
        <LikeButton image={image} onLike={toggleLike} />
      </div>

      <h3 className="h5 mb-3">More like this</h3>
      {recommended.length > 0 ? (
        <ImageGrid images={recommended} onLike={toggleLike} />
      ) : (
        <p className="text-body-secondary">No other images yet.</p>
      )}
    </>
  )
}

export default ImageDetail
