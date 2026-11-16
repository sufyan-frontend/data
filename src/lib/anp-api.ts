import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/anp-auth'
import { NotFoundError, ValidationError } from '@/lib/anp-store'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cms-secret',
}

export const preflight = () => new NextResponse(null, { status: 204, headers: CORS })

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS, ...extra } })
}

/** A dashboard login token (Bearer) or the server-to-server CMS_SECRET. */
export function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && verifyToken(auth.slice(7).trim())) return true

  const expected = process.env.CMS_SECRET
  const given = req.headers.get('x-cms-secret')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const unauthorized = () => json({ error: 'Please log in again' }, 401)
export const unknownPage = () => json({ error: 'Unknown page' }, 404)

/** Maps store errors to HTTP status codes. */
export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  if (err instanceof ValidationError) return json({ error: message }, 400)
  if (err instanceof NotFoundError) return json({ error: message }, 404)
  console.error('[anp api]', err)
  return json({ error: 'Server error, please try again' }, 500)
}
