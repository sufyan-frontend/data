'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  addProjectAction,
  moveProjectAction,
  removeProjectAction,
  setProjectFlagAction,
  type ActionState,
} from '../actions'
import type { Project } from '@/lib/github-projects'

const input =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const label = 'block text-sm font-medium text-gray-700 mb-1'

/**
 * Screenshots are stored either as an absolute raw.githubusercontent URL (uploaded
 * here) or as a path relative to the portfolio site (files that already live in its
 * public folder). The latter must be resolved against whichever frontend this admin
 * is pointed at — resolving them against production would show broken thumbnails
 * locally for any screenshot not yet deployed.
 */
function resolveThumb(image: string, siteUrl: string): string {
  return image.startsWith('http') ? image : `${siteUrl}${image}`
}

export default function ProjectsPanel({
  projects,
  siteUrl,
}: {
  projects: Project[]
  /** Where site-relative screenshots are served from — see resolveThumb(). */
  siteUrl: string
}) {
  const [state, formAction, saving] = useActionState<ActionState | null, FormData>(
    addProjectAction,
    null,
  )
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  // Reset the form once a project saves.
  useEffect(() => {
    if (state?.success) {
      setFormKey(k => k + 1)
      setPreview(null)
    }
  }, [state?.success])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { setPreview(null); return }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This removes it from the live site and cannot be undone.`)) return
    startTransition(() => { removeProjectAction(id) })
  }

  const production = projects.filter(p => p.kind === 'production')
  const practice = projects.filter(p => p.kind === 'practice')

  return (
    <div className="space-y-10">
      {/* ── Add form ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Project</h2>
        <form
          key={formKey}
          action={formAction}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          {state?.success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              ✓ Project saved to the data repo.
            </div>
          )}
          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {state.error}
            </div>
          )}

          <div>
            <label className={label}>Title <span className="text-red-500">*</span></label>
            <input name="title" type="text" required placeholder="Shifa Care Home" className={input} />
          </div>

          <div>
            <label className={label}>Live URL <span className="text-red-500">*</span></label>
            <input name="url" type="text" required placeholder="https://example.com" className={input} />
          </div>

          <div>
            <label className={label}>Description <span className="text-red-500">*</span></label>
            <textarea
              name="description"
              rows={3}
              required
              placeholder="What the site is and what you built."
              className={`${input} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>
                Tags <span className="text-gray-400 font-normal">(comma separated)</span>
              </label>
              <input name="tags" type="text" placeholder="Next.js, Healthcare" className={input} />
            </div>
            <div>
              <label className={label}>Section</label>
              <select name="kind" defaultValue="production" className={input}>
                <option value="production">Production (client work)</option>
                <option value="practice">Practice website</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label}>
              Screenshot <span className="text-gray-400 font-normal">(max 8 MB)</span>
            </label>
            <div className="flex gap-4 items-start">
              <label className="flex-1 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                <input name="image" type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                <span className="text-sm text-gray-500">
                  {preview ? 'Change screenshot' : 'Click to select a screenshot'}
                </span>
              </label>
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-24 h-24 object-cover object-top rounded-lg border border-gray-200 flex-shrink-0"
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Or reuse an image already in the site&apos;s public folder:
            </p>
            <input
              name="imagePath"
              type="text"
              placeholder="/porfolio%20image/shifa-care-home.png"
              className={`${input} mt-1 font-mono text-xs`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="featured" type="checkbox" className="rounded border-gray-300" />
            Show in the home-page featured grid
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {saving ? 'Saving to GitHub…' : 'Add Project'}
          </button>
        </form>
      </section>

      <ProjectList
        heading="Production Projects"
        projects={production}
        siteUrl={siteUrl}
        pending={pending}
        onMove={(id, dir) => startTransition(() => { moveProjectAction(id, dir) })}
        onFlag={(id, field, value) => startTransition(() => { setProjectFlagAction(id, field, value) })}
        onDelete={handleDelete}
      />

      <ProjectList
        heading="Practice Websites"
        projects={practice}
        siteUrl={siteUrl}
        pending={pending}
        onMove={(id, dir) => startTransition(() => { moveProjectAction(id, dir) })}
        onFlag={(id, field, value) => startTransition(() => { setProjectFlagAction(id, field, value) })}
        onDelete={handleDelete}
      />
    </div>
  )
}

function ProjectList({
  heading,
  projects,
  siteUrl,
  pending,
  onMove,
  onFlag,
  onDelete,
}: {
  heading: string
  projects: Project[]
  siteUrl: string
  pending: boolean
  onMove: (id: string, dir: 'up' | 'down') => void
  onFlag: (id: string, field: 'featured' | 'active', value: boolean) => void
  onDelete: (id: string, title: string) => void
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {heading} <span className="text-gray-400 font-normal text-base">({projects.length})</span>
      </h2>

      {projects.length === 0 ? (
        <p className="text-gray-400 text-sm bg-white rounded-2xl border border-gray-100 p-6 text-center">
          Nothing here yet — add one above.
        </p>
      ) : (
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 p-4 ${
                p.active ? '' : 'opacity-60'
              }`}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onMove(p.id, 'up')}
                  disabled={pending || i === 0}
                  aria-label={`Move ${p.title} up`}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-25 text-xs leading-none px-1"
                >
                  ▲
                </button>
                <button
                  onClick={() => onMove(p.id, 'down')}
                  disabled={pending || i === projects.length - 1}
                  aria-label={`Move ${p.title} down`}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-25 text-xs leading-none px-1"
                >
                  ▼
                </button>
              </div>

              {p.image ? (
                <img
                  src={resolveThumb(p.image, siteUrl)}
                  alt={p.title}
                  className="w-16 h-16 object-cover object-top rounded-lg flex-shrink-0 bg-gray-100"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">
                  🖼️
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{p.title}</p>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-xs truncate hover:underline block"
                >
                  {p.url}
                </a>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.tags.map(tag => (
                    <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={p.featured}
                      disabled={pending}
                      onChange={e => onFlag(p.id, 'featured', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Featured
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={p.active}
                      disabled={pending}
                      onChange={e => onFlag(p.id, 'active', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Live
                  </label>
                </div>
                <button
                  onClick={() => onDelete(p.id, p.title)}
                  disabled={pending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
