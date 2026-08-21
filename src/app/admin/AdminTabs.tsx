'use client'

import { useState } from 'react'
import AdminClient from './AdminClient'
import ProjectsPanel from './ProjectsPanel'
import type { PostEntry } from '@/lib/github-cms'
import type { Project } from '@/lib/github-projects'

interface PostWithUrl extends PostEntry {
  imageUrl: string | null
}

type Tab = 'posts' | 'projects'

/**
 * Page chrome for /admin: header, tab bar, and the shared container that both
 * panels render inside.
 */
export default function AdminTabs({
  posts,
  projects,
  siteUrl,
}: {
  posts: PostWithUrl[]
  projects: Project[]
  siteUrl: string
}) {
  const [tab, setTab] = useState<Tab>('posts')

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'posts', label: 'Posts', count: posts.length },
    { key: 'projects', label: 'Projects', count: projects.length },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 pt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <a href="/posts" className="text-sm text-blue-600 hover:underline">View all posts →</a>

        <div className="w-full flex gap-1 -mb-px" role="tablist" aria-label="Admin sections">
          {tabs.map(t => {
            const selected = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  selected
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}{' '}
                <span className={selected ? 'text-blue-400' : 'text-gray-400'}>({t.count})</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {tab === 'posts' ? <AdminClient posts={posts} /> : <ProjectsPanel projects={projects} siteUrl={siteUrl} />}
      </div>
    </div>
  )
}
