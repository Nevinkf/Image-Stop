import { Link } from 'react-router-dom'

// Each tag links to the gallery filtered by that tag
function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="d-flex flex-wrap gap-1 mt-1">
      {tags.map((t) => (
        <Link
          key={t}
          to={`/?tag=${encodeURIComponent(t)}`}
          className="badge rounded-pill text-bg-light border text-decoration-none"
        >
          #{t}
        </Link>
      ))}
    </div>
  )
}

export default TagList
