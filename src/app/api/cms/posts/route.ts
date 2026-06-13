import { NextRequest, NextResponse } from 'next/server'
import { fetchAllPosts, createPost } from '@/lib/github-cms'

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-cms-secret') === process.env.CMS_SECRET
}

/** GET /api/cms/posts — returns the full post index */
export async function GET() {
  try {
    const posts = await fetchAllPosts()
    return NextResponse.json({ posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/cms/posts — creates a new post
 *
 * Expects multipart/form-data with:
 *   title        string (required)
 *   description  string (required)
 *   content      string — markdown body
 *   author       string
 *   tags         string[] — send multiple "tags" fields, or comma-separated
 *   image        File   — cover image (jpg/png/webp, ideally < 1 MB)
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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

    const post = await createPost({ title, description, content, imageBase64, imageExt, tags, author })
    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
