export type Image = {
  id: number
  title: string
  url: string
  uploader: string | null
  likeCount: number
  likedByMe: boolean
  tags: string[]
}
