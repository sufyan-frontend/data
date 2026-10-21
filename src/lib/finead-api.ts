import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { NotFoundError, ValidationError, type ImageUpload } from '@/lib/finead-store'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-cms-secret',
}

export function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CMS_SECRET
  const given = req.headers.get('x-cms-secret')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

export const unauthorized = () => json({ error: 'Unauthorized' }, 401)
export const unknownCollection = () => json({ error: 'Unknown collection' }, 404)

/** Maps store errors to HTTP status codes. */
export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  if (err instanceof ValidationError) return json({ error: message }, 400)
  if (err instanceof NotFoundError) return json({ error: message }, 404)
  console.error('[finead api]', err)
  return json({ error: message }, 500)
}

const MAX_IMAGE = 4 * 1024 * 1024

/**
 * Accepts JSON or multipart/form-data. In multipart, an `image` file field is
 * returned separately and list fields may be sent as newline-separated text.
 */
export async function readBody(req: NextRequest): Promise<{ data: Record<string, unknown>; image: ImageUpload | null }> {
  const type = req.headers.get('content-type') ?? ''
  if (!type.includes('multipart/form-data')) {
    const data = await req.json().catch(() => null)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ValidationError('Invalid request body')
    return { data, image: null }
  }

  const form = await req.formData()
  const data: Record<string, unknown> = {}
  let image: ImageUpload | null = null
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      data[key] = value
    } else if (key === 'image' && value.size > 0) {
      if (value.size > MAX_IMAGE) throw new ValidationError('Image must be under 4 MB')
      image = {
        base64: Buffer.from(await value.arrayBuffer()).toString('base64'),
        ext: value.type.split('/')[1] || 'jpg',
      }
    }
  }
  return { data, image }
}
