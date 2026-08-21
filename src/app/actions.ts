'use server'

import { createPost, deletePost } from '@/lib/github-cms'
import {
  createProject,
  deleteProject,
  fetchAllProjects,
  reorderProjects,
  updateProject,
  type ProjectKind,
} from '@/lib/github-projects'
import { revalidatePath } from 'next/cache'

export interface ActionState {
  error?: string
  success?: boolean
}

export async function addPostAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const title = (formData.get('title') as string)?.trim()
    if (!title) return { error: 'Title is required' }

    const description = (formData.get('description') as string) ?? ''
    const content = (formData.get('content') as string) ?? ''
    const author = (formData.get('author') as string) ?? ''
    const tags = ((formData.get('tags') as string) ?? '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    const imageFile = formData.get('image') as File | null

    let imageBase64: string | null = null
    let imageExt = 'jpg'
    if (imageFile && imageFile.size > 0) {
      imageBase64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')
      imageExt = (imageFile.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    }

    await createPost({ title, description, content, imageBase64, imageExt, tags, author })
    revalidatePath('/posts')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

export async function removePostAction(slug: string): Promise<void> {
  await deletePost(slug)
  revalidatePath('/posts')
  revalidatePath('/admin')
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function addProjectAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const title = (formData.get('title') as string)?.trim()
    if (!title) return { error: 'Title is required' }

    const url = (formData.get('url') as string)?.trim()
    if (!url) return { error: 'Live URL is required' }

    const description = ((formData.get('description') as string) ?? '').trim()
    if (!description) return { error: 'Description is required' }

    const tags = ((formData.get('tags') as string) ?? '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const imageFile = formData.get('image') as File | null
    let imageBase64: string | null = null
    let imageExt = 'png'
    if (imageFile && imageFile.size > 0) {
      if (imageFile.size > 8 * 1024 * 1024) return { error: 'Screenshot must be under 8 MB' }
      imageBase64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')
      imageExt = (imageFile.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    }

    await createProject({
      title,
      description,
      url,
      tags,
      kind: ((formData.get('kind') as string) === 'practice' ? 'practice' : 'production') as ProjectKind,
      featured: formData.get('featured') === 'on',
      active: true,
      // Lets you point at a screenshot already sitting in the frontend's public
      // folder instead of re-uploading it.
      image: ((formData.get('imagePath') as string) ?? '').trim() || null,
      imageBase64,
      imageExt,
    })
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save project' }
  }
}

export async function removeProjectAction(id: string): Promise<void> {
  await deleteProject(id)
  revalidatePath('/admin')
}

/** Flips the "featured" or "active" switch on one project. */
export async function setProjectFlagAction(
  id: string,
  field: 'featured' | 'active',
  value: boolean,
): Promise<void> {
  await updateProject(id, { [field]: value })
  revalidatePath('/admin')
}

/**
 * Moves a project one slot up or down within its own kind, then rewrites the
 * order for the whole list so the numbers stay contiguous.
 */
export async function moveProjectAction(id: string, direction: 'up' | 'down'): Promise<void> {
  const all = await fetchAllProjects()
  const target = all.find(p => p.id === id)
  if (!target) return

  const sameKind = all.filter(p => p.kind === target.kind)
  const i = sameKind.findIndex(p => p.id === id)
  const j = direction === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= sameKind.length) return

  ;[sameKind[i], sameKind[j]] = [sameKind[j], sameKind[i]]

  // Rebuild the full id list, keeping the other kind exactly where it was.
  const otherKind = all.filter(p => p.kind !== target.kind)
  const merged = target.kind === 'production'
    ? [...sameKind, ...otherKind]
    : [...otherKind, ...sameKind]

  await reorderProjects(merged.map(p => p.id))
  revalidatePath('/admin')
}
