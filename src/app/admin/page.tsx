import { fetchAllPosts, rawUrl } from '@/lib/github-cms'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const posts = await fetchAllPosts()

  const postsWithUrls = posts.map(post => ({
    ...post,
    imageUrl: post.image ? rawUrl(post.image) : null,
  }))

  return <AdminClient posts={postsWithUrls} />
}
