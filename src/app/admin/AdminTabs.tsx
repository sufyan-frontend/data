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
    <main className="min-h-screen bg-[#f5f6f8]">
      <header className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-950 text-sm font-bold text-white">S</div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Workspace</p>
              <h1 className="text-lg font-semibold tracking-tight text-gray-950">Portfolio CMS</h1>
            </div>
          </div>
          <a href="/posts" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            View live posts <span aria-hidden="true">?</span>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-10">
        <div className="mb-7">
          <p className="text-sm font-medium text-blue-700">Content management</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">Manage your portfolio</h2>
          <p className="mt-2 text-sm text-gray-500">Create posts and keep your project showcase up to date.</p>
        </div>

        <div className="mb-7 flex flex-wrap items-center gap-3" role="tablist" aria-label="Admin sections">
          {tabs.map(t => {
            const selected = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${selected ? 'bg-gray-950 text-white shadow-sm' : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-white/15 text-gray-200' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        {tab === 'posts' ? <AdminClient posts={posts} /> : <ProjectsPanel projects={projects} siteUrl={siteUrl} />}
      </div>
    </main>
  )
}
