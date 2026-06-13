import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gray-50 min-h-screen">
      <main className="text-center space-y-6 px-6">
        <h1 className="text-4xl font-bold text-gray-900">GitHub CMS</h1>
        <p className="text-gray-500 text-lg">Store and manage posts directly in your GitHub repo.</p>
        <div className="flex gap-4 justify-center pt-2">
          <Link
            href="/posts"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            View Posts
          </Link>
          <Link
            href="/admin"
            className="bg-white text-gray-800 border border-gray-200 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Admin Panel
          </Link>
        </div>
      </main>
    </div>
  )
}
