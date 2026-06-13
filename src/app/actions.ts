'use server'

import { createPost, deletePost } from '@/lib/github-cms'
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
