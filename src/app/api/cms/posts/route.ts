import { NextRequest, NextResponse } from 'next/server'
import { fetchAllPosts, createPost } from '@/lib/github-cms'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-cms-secret',
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-cms-secret') === process.env.CMS_SECRET
}

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** GET /api/cms/posts — returns the full post index (public) */
export async function GET() {
  try {
    const posts = await fetchAllPosts()
    return NextResponse.json({ posts }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

/**
 * POST /api/cms/posts — creates a new post  (requires x-cms-secret header)
 *
 * multipart/form-data fields:
 *   title        string  (required)
 *   description  string
 *   content      string  (markdown body)
 *   author       string
 *   tags         string  (comma-separated, e.g. "news,update")
 *   image        File    (jpg / png / webp — max 10 MB)
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
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
    return NextResponse.json({ post }, { status: 201, headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
