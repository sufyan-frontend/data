import { NextRequest } from 'next/server'
import { isPage, uploadImage } from '@/lib/anp-store'
import { fail, isAuthorized, json, preflight, unauthorized, unknownPage } from '@/lib/anp-api'

export const OPTIONS = preflight

/**
 * POST /api/anp/images — upload one image (Bearer token or x-cms-secret).
 * multipart/form-data: `image` (file, max 4 MB) and `page` (page slug). Returns { url }.
 * The image is only kept if a later page save references it.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized()
  try {
    const form = await req.formData().catch(() => null)
    if (!form) return json({ error: 'Send the image as multipart/form-data' }, 400)
    const page = String(form.get('page') ?? '')
    if (!isPage(page)) return unknownPage()
    const file = form.get('image')
    if (!file || typeof file === 'string') return json({ error: 'No image file sent' }, 400)
    const url = await uploadImage(page, Buffer.from(await file.arrayBuffer()), file.type)
    return json({ url }, 201)
  } catch (err) {
    return fail(err)
  }
}
