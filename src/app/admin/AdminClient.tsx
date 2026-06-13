'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { addPostAction, removePostAction, type ActionState } from '../actions'
import type { PostEntry } from '@/lib/github-cms'

interface PostWithUrl extends PostEntry {
  imageUrl: string | null
}

export default function AdminClient({ posts }: { posts: PostWithUrl[] }) {
  const [state, formAction, uploading] = useActionState<ActionState | null, FormData>(
    addPostAction,
    null,
  )
  const [deletesPending, startDelete] = useTransition()
  const [preview, setPreview] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  // Reset form on success
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

  function handleDelete(slug: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    startDelete(() => removePostAction(slug))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <a href="/posts" className="text-sm text-blue-600 hover:underline">View all posts →</a>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">

        {/* ── Upload Form ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload New Post</h2>
          <form
            key={formKey}
            action={formAction}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
          >
            {/* Status banners */}
            {state?.success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                ✓ Post uploaded successfully!
              </div>
            )}
            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {state.error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder="Enter post title"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Short summary shown on post cards"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content <span className="text-gray-400 font-normal">(Markdown)</span>
              </label>
              <textarea
                name="content"
                rows={6}
                placeholder="Write your post content in Markdown..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Author + Tags row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input
                  name="author"
                  type="text"
                  placeholder="Your name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags <span className="text-gray-400 font-normal">(comma separated)</span>
                </label>
                <input
                  name="tags"
                  type="text"
                  placeholder="news, update, tech"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cover Image <span className="text-gray-400 font-normal">(max ~1 MB)</span>
              </label>
              <div className="flex gap-4 items-start">
                <label className="flex-1 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                  <span className="text-sm text-gray-500">
                    {preview ? 'Change image' : 'Click to select image'}
                  </span>
                </label>
                {preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                  />
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {uploading ? 'Uploading to GitHub…' : 'Upload Post'}
            </button>
          </form>
        </section>

        {/* ── Existing Posts ──────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Existing Posts{' '}
            <span className="text-gray-400 font-normal text-base">({posts.length})</span>
          </h2>

          {posts.length === 0 ? (
            <p className="text-gray-400 text-sm bg-white rounded-2xl border border-gray-100 p-6 text-center">
              No posts yet — upload one above.
            </p>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div
                  key={post.slug}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 p-4"
                >
                  {/* Thumbnail */}
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">
                      📄
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{post.title}</p>
                    {post.description && (
                      <p className="text-gray-500 text-xs truncate mt-0.5">{post.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {post.tags?.map(tag => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Date + Delete */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{post.date}</span>
                    <button
                      onClick={() => handleDelete(post.slug, post.title)}
                      disabled={deletesPending}
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
      </div>
    </div>
  )
}
