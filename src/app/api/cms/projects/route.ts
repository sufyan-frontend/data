import { NextRequest, NextResponse } from 'next/server'
import {
  fetchActiveProjects,
  fetchAllProjects,
  createProject,
  reorderProjects,
  type ProjectKind,
} from '@/lib/github-projects'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-cms-secret',
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-cms-secret') === process.env.CMS_SECRET
}

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/cms/projects                  — active projects, ordered (public)
 * GET /api/cms/projects?kind=production  — only client work
 * GET /api/cms/projects?kind=practice    — only practice builds
 * GET /api/cms/projects?featured=1       — only home-page picks
 * GET /api/cms/projects?all=1            — includes hidden (requires x-cms-secret)
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const wantAll = params.get('all') === '1'
    let projects = wantAll && isAuthorized(req)
      ? await fetchAllProjects()
      : await fetchActiveProjects()

    const kind = params.get('kind')
    if (kind === 'production' || kind === 'practice') {
      projects = projects.filter(p => p.kind === (kind as ProjectKind))
    }
    if (params.get('featured') === '1') {
      projects = projects.filter(p => p.featured)
    }

    const limit = Number(params.get('limit'))
    if (Number.isFinite(limit) && limit > 0) projects = projects.slice(0, limit)

    return NextResponse.json({ projects }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

/**
 * POST /api/cms/projects — creates a project  (requires x-cms-secret header)
 *
 * multipart/form-data fields:
 *   title        string  (required)
 *   description  string  (required)
 *   url          string  (required — the live site)
 *   tags         string  (comma-separated, e.g. "Next.js,Corporate")
 *   kind         string  ("production" | "practice", default "production")
 *   featured     string  ("1"/"true" to show in the home-page teaser)
 *   active       string  ("0"/"false" to keep it hidden)
 *   imagePath    string  (site-relative path, used when no file is uploaded)
 *   image        File    (screenshot — png / jpg / webp)
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  try {
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

    const tags = form
      .getAll('tags')
      .flatMap(t => String(t).split(','))
      .map(s => s.trim())
      .filter(Boolean)

    const kindRaw = String(form.get('kind') ?? 'production')
    const project = await createProject({
      title: form.get('title') as string,
      description: form.get('description') as string,
      url: form.get('url') as string,
      tags,
      kind: kindRaw === 'practice' ? 'practice' : 'production',
      featured: /^(1|true|on)$/i.test(String(form.get('featured') ?? '')),
      active: !/^(0|false|off)$/i.test(String(form.get('active') ?? '1')),
      image: (form.get('imagePath') as string) || null,
      imageBase64,
      imageExt,
    })
    return NextResponse.json({ project }, { status: 201, headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isValidation = /required|not a valid URL|under 8 MB/i.test(message)
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500, headers: CORS })
  }
}

/**
 * PATCH /api/cms/projects — rewrites display order  (requires x-cms-secret header)
 * JSON body: { "ids": ["shifa-care-home", "ehya", …] } — first id sorts first.
 */
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  try {
    const body = await req.json()
    if (!Array.isArray(body?.ids)) {
      return NextResponse.json({ error: '"ids" must be an array' }, { status: 400, headers: CORS })
    }
    const projects = await reorderProjects(body.ids.map(String))
    return NextResponse.json({ projects }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
