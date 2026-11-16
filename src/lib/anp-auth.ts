import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Login for the ANP website dashboard.
 *
 * The ANP client gets their own password, separate from the portfolio admin:
 *   ANP_ADMIN_PASSWORD_HASH  — create with: node scripts/hash-password.mjs "<password>"
 *   ANP_SESSION_SECRET       — signs login tokens (falls back to SESSION_SECRET).
 *                              Changing it logs every dashboard user out.
 *
 * A successful login returns a signed token (valid 7 days) that the dashboard
 * sends as `Authorization: Bearer <token>`. No cookies, so it works cross-origin.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret(): string {
  const s = process.env.ANP_SESSION_SECRET || process.env.SESSION_SECRET
  if (!s) throw new Error('ANP_SESSION_SECRET (or SESSION_SECRET) is not set')
  return s
}

const b64url = (buf: Buffer) => buf.toString('base64url')

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest())
}

function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function isLoginConfigured(): boolean {
  return Boolean(process.env.ANP_ADMIN_PASSWORD_HASH && (process.env.ANP_SESSION_SECRET || process.env.SESSION_SECRET))
}

/** Hash format (from scripts/hash-password.mjs): scrypt$<salt hex>$<hash hex> */
export function checkPassword(password: string): boolean {
  const stored = process.env.ANP_ADMIN_PASSWORD_HASH ?? ''
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return safeEqual(actual, expected)
}

export function issueToken(): { token: string; expiresAt: string } {
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = b64url(Buffer.from(JSON.stringify({ scope: 'anp', exp })))
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() }
}

export function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  try {
    if (!safeEqual(sig, sign(payload))) return false
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    return data.scope === 'anp' && typeof data.exp === 'number' && data.exp > Date.now()
  } catch {
    return false
  }
}
