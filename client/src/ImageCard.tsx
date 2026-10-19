import { Link } from 'react-router-dom'
import TagList from './TagList'
import LikeButton from './LikeButton'
import type { Image } from './types'

type Props = {
  image: Image
  onLike: (image: Image) => void
}

function ImageCard({ image, onLike }: Props) {
  const href = `/images/${image.id}`
  return (
    <div className="card shadow-sm h-100">
      <Link to={href}>
        <img className="card-img-top thumb" src={image.url} alt={image.title} loading="lazy" />
      </Link>
      <div className="card-body d-flex justify-content-between align-items-start gap-2">
        <div className="min-w-0">
          <Link to={href} className="card-text d-block text-break text-reset text-decoration-none">
            {image.title}
          </Link>
          {image.uploader && <small className="text-body-secondary">by {image.uploader}</small>}
          <TagList tags={image.tags} />
        </div>
        <LikeButton image={image} onLike={onLike} />
      </div>
    </div>
  )
}

export default ImageCard
