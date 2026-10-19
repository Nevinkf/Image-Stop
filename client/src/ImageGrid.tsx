import ImageCard from './ImageCard'
import type { Image } from './types'

// Columns grow with the viewport: 1 on phones up to 5 on very wide screens
function ImageGrid({ images, onLike }: { images: Image[]; onLike: (image: Image) => void }) {
  return (
    <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 row-cols-xxl-5 g-3">
      {images.map((image) => (
        <div className="col" key={image.id}>
          <ImageCard image={image} onLike={onLike} />
        </div>
      ))}
    </div>
  )
}

export default ImageGrid
