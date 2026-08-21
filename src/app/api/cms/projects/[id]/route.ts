import { NextRequest, NextResponse } from 'next/server'
import { fetchProjectById, updateProject, deleteProject } from '@/lib/github-projects'

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

/** GET /api/cms/projects/:id — a single project (public) */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const project = await fetchProjectById(id)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: CORS })
    return NextResponse.json({ project }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

/**
 * PUT /api/cms/projects/:id — updates a project  (requires x-cms-secret header)
 *
 * Accepts multipart/form-data (same fields as POST) or a JSON body. Only the
 * fields actually present are changed — omit "image" to keep the current one.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  const { id } = await context.params
  try {
    const contentType = req.headers.get('content-type') ?? ''

    // JSON body — handy for quick field flips like { "featured": true }.
    if (contentType.includes('application/json')) {
      const project = await updateProject(id, await req.json())
      return NextResponse.json({ project }, { headers: CORS })
    }

    const form = await req.formData()
    const imageFile = form.get('image') as File | null

    let imageBase64: string | null = null
    let imageExt = 'png'
    if (imageFile && typeof imageFile !== 'string' && imageFile.size > 0) {
      if (imageFile.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Screenshot must be under 8 MB' }, { status: 400, headers: CORS })
      }
      imageBase64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')
      imageExt = (imageFile.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    }

    // Build the patch from the fields that were actually submitted, so a form
    // that omits a field leaves the stored value untouched.
    const patch: Parameters<typeof updateProject>[1] = {}
    if (form.has('title')) patch.title = form.get('title') as string
    if (form.has('description')) patch.description = form.get('description') as string
    if (form.has('url')) patch.url = form.get('url') as string
    if (form.has('tags')) {
      patch.tags = form
        .getAll('tags')
        .flatMap(t => String(t).split(','))
        .map(s => s.trim())
        .filter(Boolean)
    }
    if (form.has('kind')) {
      patch.kind = String(form.get('kind')) === 'practice' ? 'practice' : 'production'
    }
    if (form.has('featured')) patch.featured = /^(1|true|on)$/i.test(String(form.get('featured')))
    if (form.has('active')) patch.active = /^(1|true|on)$/i.test(String(form.get('active')))
    if (form.has('order')) patch.order = Number(form.get('order'))
    if (form.has('imagePath')) patch.image = (form.get('imagePath') as string) || null
    if (imageBase64) {
      patch.imageBase64 = imageBase64
      patch.imageExt = imageExt
    }

    const project = await updateProject(id, patch)
    return NextResponse.json({ project }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = /not found/i.test(message) ? 404
      : /required|not a valid URL|under 8 MB/i.test(message) ? 400
      : 500
    return NextResponse.json({ error: message }, { status, headers: CORS })
  }
}

/** DELETE /api/cms/projects/:id — removes the project and its uploaded image  (requires x-cms-secret header) */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  const { id } = await context.params
  try {
    await deleteProject(id)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
