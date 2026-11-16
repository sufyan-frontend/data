import { NextRequest } from 'next/server'
import { isAuthorized, json, preflight, unauthorized } from '@/lib/anp-api'

export const OPTIONS = preflight

/** GET /api/anp/auth/me — 200 while the Bearer token is valid, 401 otherwise. */
export function GET(req: NextRequest) {
  return isAuthorized(req) ? json({ ok: true }) : unauthorized()
}
