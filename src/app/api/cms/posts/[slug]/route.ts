import { NextRequest, NextResponse } from 'next/server'
import { fetchPostBySlug, updatePost, deletePost } from '@/lib/github-cms'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-cms-secret',
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-cms-secret') === process.env.CMS_SECRET
}

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** GET /api/cms/posts/:slug — returns full post with markdown content (public) */
export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  try {
    const post = await fetchPostBySlug(slug)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: CORS })
    return NextResponse.json({ post }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

/**
 * PUT /api/cms/posts/:slug — updates an existing post  (requires x-cms-secret header)
 * Same multipart/form-data shape as POST; omit "image" to keep the existing cover.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
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
    return NextResponse.json({ post }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

/** DELETE /api/cms/posts/:slug — removes post, image, and index entry  (requires x-cms-secret header) */
export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  const { slug } = await context.params
  try {
    await deletePost(slug)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
