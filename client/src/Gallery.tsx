import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { api } from './api'
import { useAuth } from './AuthContext'
import { useDebounced } from './useDebounced'
import { useLikeToggle } from './useLikeToggle'
import SearchBar from './SearchBar'
import ImageGrid from './ImageGrid'
import type { Image } from './types'

type Props = {
  requireLogin: () => void
  uploadCount: number
}

function Gallery({ requireLogin, uploadCount }: Props) {
  const { user } = useAuth()
  const [images, setImages] = useState<Image[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 300)

  // Tag filter lives in the URL so tag links from any page land on a filtered gallery
  const [searchParams, setSearchParams] = useSearchParams()
  const tag = searchParams.get('tag')

  const loadImages = useCallback((signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (tag) params.set('tag', tag)
    const qs = params.toString()
    return api<Image[]>(`/api/images${qs ? `?${qs}` : ''}`, { signal })
      .then(setImages)
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to load images', err)
      })
  }, [debouncedSearch, tag])

  // Reload when the user changes so likedByMe matches whoever is logged in, and after uploads.
  // Abort the previous request so a slow, stale search can't overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController()
    loadImages(controller.signal)
    return () => controller.abort()
  }, [loadImages, user?.id, uploadCount])

  const toggleLike = useLikeToggle(
    (id, patch) => setImages((imgs) => imgs.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    requireLogin
  )

  return (
    <>
      <SearchBar search={search} onSearch={setSearch} tag={tag} onClearTag={() => setSearchParams({})} />
      {images.length === 0 && (debouncedSearch || tag) && (
        <p className="text-body-secondary">No images match your search.</p>
      )}
      <ImageGrid images={images} onLike={toggleLike} />
    </>
  )
}

export default Gallery
