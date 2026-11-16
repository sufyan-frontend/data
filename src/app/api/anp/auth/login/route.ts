import { NextRequest } from 'next/server'
import { checkPassword, isLoginConfigured, issueToken } from '@/lib/anp-auth'
import { json, preflight } from '@/lib/anp-api'

export const OPTIONS = preflight

/** POST /api/anp/auth/login — body { password } → { token, expiresAt } */
export async function POST(req: NextRequest) {
  if (!isLoginConfigured()) return json({ error: 'Dashboard login is not set up on the server' }, 503)

  const body = await req.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password || password.length > 200 || !checkPassword(password)) {
    // Slow down password guessing.
    await new Promise(r => setTimeout(r, 800))
    return json({ error: 'Wrong password' }, 401)
  }
  return json(issueToken())
}
