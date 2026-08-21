import { fetchAllPosts } from '@/lib/github-cms'
import { fetchAllProjects } from '@/lib/github-projects'
import AdminTabs from './AdminTabs'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  // Both stores live in the same GitHub repo — fetch them in parallel so the
  // panel is not waiting on two sequential round trips.
  const [posts, projects] = await Promise.all([fetchAllPosts(), fetchAllProjects()])

  // post.image is already a full URL in data.json — no wrapping needed
  const postsWithUrls = posts.map(post => ({
    ...post,
    imageUrl: post.image ?? null,
  }))

  // Site-relative project screenshots are served by the portfolio frontend, so
  // thumbnails resolve against whichever frontend this admin is pointed at.
  const siteUrl = (process.env.FRONTEND_URL || 'https://sufyan-frontend.vercel.app').replace(/\/$/, '')

  return <AdminTabs posts={postsWithUrls} projects={projects} siteUrl={siteUrl} />
}
