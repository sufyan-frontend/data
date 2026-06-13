import { fetchAllPosts } from '@/lib/github-cms'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const posts = await fetchAllPosts()

  // post.image is already a full URL stored in data.json — no wrapping needed
  const postsWithUrls = posts.map(post => ({
    ...post,
    imageUrl: post.image ?? null,
  }))

  return <AdminClient posts={postsWithUrls} />
}
