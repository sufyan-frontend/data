import { fetchAllPosts } from '@/lib/github-cms'
import Link from 'next/link'

export const revalidate = 60

export default async function PostsPage() {
  const posts = await fetchAllPosts()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
        <Link
          href="/admin"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Post
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg">No posts yet.</p>
            <Link href="/admin" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
              Upload your first post →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <div
                key={post.slug}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
              >
                {post.image ? (
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    <span className="text-4xl">📄</span>
                  </div>
                )}

                <div className="p-4 flex flex-col flex-1">
                  {/* Tags */}
                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {post.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <h2 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                    {post.title}
                  </h2>

                  {post.description && (
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2 flex-1">
                      {post.description}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>{post.author || 'Unknown'}</span>
                    <span>{post.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
