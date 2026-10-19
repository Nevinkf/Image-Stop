import { Button } from 'react-bootstrap'
import type { Image } from './types'

function LikeButton({ image, onLike }: { image: Image; onLike: (image: Image) => void }) {
  return (
    <Button
      size="sm"
      className="flex-shrink-0"
      variant={image.likedByMe ? 'danger' : 'outline-danger'}
      aria-pressed={image.likedByMe}
      onClick={() => onLike(image)}
    >
      ♥ {image.likeCount}
    </Button>
  )
}

export default LikeButton
