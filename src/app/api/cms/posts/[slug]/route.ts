import { NextRequest, NextResponse } from 'next/server'
import { fetchPostBySlug, updatePost, deletePost } from '@/lib/github-cms'

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-cms-secret') === process.env.CMS_SECRET
}

/** GET /api/cms/posts/[slug] — returns full post with content */
export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  try {
    const post = await fetchPostBySlug(slug)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PUT /api/cms/posts/[slug] — updates an existing post
 * Same multipart/form-data shape as POST; omit "image" to keep the existing cover.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await context.params
  try {
    const formData = await req.formData()
    const title = formData.get('title') as string
    const description = (formData.get('description') as string) ?? ''
    const content = (formData.get('content') as string) ?? ''
    const author = (formData.get('author') as string) ?? ''
    const tags = formData
      .getAll('tags')
      .flatMap(t => (t as string).split(',').map(s => s.trim()))
      .filter(Boolean)
    const imageFile = formData.get('image') as File | null

    let imageBase64: string | null = null
    let imageExt = 'jpg'
    if (imageFile && imageFile.size > 0) {
      imageBase64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')
      imageExt = (imageFile.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    }

    const post = await updatePost(slug, { title, description, content, imageBase64, imageExt, tags, author })
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/cms/posts/[slug] — removes the post, its image, and the data.json entry */
export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await context.params
  try {
    await deletePost(slug)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
