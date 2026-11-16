import { NextRequest } from 'next/server'
import { getPage, isPage, savePage } from '@/lib/anp-store'
import { revalidateFrontendTag } from '@/lib/revalidate-frontend'
import { fail, isAuthorized, json, preflight, unauthorized, unknownPage } from '@/lib/anp-api'

type Context = { params: Promise<{ slug: string }> }

export const OPTIONS = preflight

/** GET /api/anp/pages/:slug — saved page content (public). 404 when never saved. */
export async function GET(_req: NextRequest, { params }: Context) {
  const { slug } = await params
  if (!isPage(slug)) return unknownPage()
  try {
    const page = await getPage(slug)
    if (!page) return json({ error: 'Page has no saved content yet' }, 404)
    return json({ page })
  } catch (err) {
    return fail(err)
  }
}

/**
 * PUT /api/anp/pages/:slug — replace the page content (Bearer token or x-cms-secret).
 * Body: { content: { ... } }. Images must already be uploaded via POST /api/anp/images.
 */
export async function PUT(req: NextRequest, { params }: Context) {
  const { slug } = await params
  if (!isPage(slug)) return unknownPage()
  if (!isAuthorized(req)) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request body' }, 400)
  try {
    const page = await savePage(slug, body.content)
    const frontendRevalidated = await revalidateFrontendTag(`anp-page-${slug}`)
    return json({ page, frontendRevalidated })
  } catch (err) {
    return fail(err)
  }
}
