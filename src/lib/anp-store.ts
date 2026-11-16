/**
 * ANP store — editable page content for the ANP Engineering & Construction website
 * (d:\hassanclient\anpengcon), kept in the same GitHub data repo as the other CMS data.
 *
 * Reuses the same env vars as github-cms.ts:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 *
 * Repo layout:
 *   anp/pages/{slug}.json                 — { slug, content, updatedAt } for one page
 *   anp/images/{slug}/{t}-{rand}.{ext}    — images uploaded from the dashboard
 *                                           (unique names, so the raw CDN never serves a stale copy)
 *
 * `content` is free-form JSON (whatever the page's sections need). The website merges
 * it over its own built-in defaults, so a missing field never breaks a page.
 */

const GH_API = 'https://api.github.com'

function cfg() {
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
  }
}

function ghHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg().token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function contentsUrl(path: string): string {
  const { owner, repo } = cfg()
  return `${GH_API}/repos/${owner}/${repo}/contents/${path}`
}

function rawBase(): string {
  const { owner, repo, branch } = cfg()
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
}

interface GHFile {
  content: string
  sha: string
}

async function getFile(path: string): Promise<GHFile | null> {
  const { branch } = cfg()
  const res = await fetch(`${contentsUrl(path)}?ref=${branch}`, { headers: ghHeaders(), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

class ShaConflict extends Error {}

async function putFile(path: string, base64: string, message: string, sha?: string | null): Promise<void> {
  const { branch } = cfg()
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({ message, content: base64, branch, ...(sha && { sha }) }),
  })
  // 409/422 mean the file changed since we read it (two saves at once).
  if (res.status === 409 || res.status === 422) throw new ShaConflict(await res.text())
  if (!res.ok) throw new Error(`GitHub PUT ${path} → ${res.status}: ${await res.text()}`)
}

async function deleteFile(path: string, message: string): Promise<void> {
  const file = await getFile(path)
  if (!file) return
  const { branch } = cfg()
  const res = await fetch(contentsUrl(path), {
    method: 'DELETE',
    headers: ghHeaders(),
    body: JSON.stringify({ message, sha: file.sha, branch }),
  })
  if (!res.ok) throw new Error(`GitHub DELETE ${path} → ${res.status}: ${await res.text()}`)
}

// GitHub wraps base64 content in newlines every 60 chars — strip before decoding.
function decode(content: string): string {
  return Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8')
}

/** Thrown for bad input; API routes map it to HTTP 400. */
export class ValidationError extends Error {}
/** Thrown for an unknown page; API routes map it to HTTP 404. */
export class NotFoundError extends Error {}

// ─── Pages ───────────────────────────────────────────────────────────────────

/** Every page of the website. `path` is the public URL on the ANP site. */
export const PAGES = [
  { slug: 'home', title: 'Home', path: '/' },
  { slug: 'about', title: 'About', path: '/about' },
  { slug: 'about-overview', title: 'About · Overview', path: '/about/overview' },
  { slug: 'about-hse-policy', title: 'About · Health, Safety & Environment Policy', path: '/about/health-safety-environment-policy' },
  { slug: 'about-quality-policy', title: 'About · Quality Policy', path: '/about/quality-policy' },
  { slug: 'about-awards', title: 'About · Award & Recognition', path: '/about/award-recognition' },
  { slug: 'about-teams', title: 'About · Teams', path: '/about/teams' },
  { slug: 'services', title: 'Services', path: '/services' },
  { slug: 'services-mechanical-works', title: 'Services · Mechanical Works', path: '/services/mechanical-works' },
  { slug: 'services-civil-works', title: 'Services · Civil Works', path: '/services/civil-works' },
  { slug: 'services-electrical-instrumentation', title: 'Services · Electrical & Instrumentation', path: '/services/electrical-instrumentation' },
  { slug: 'services-manpower-equipments-supply', title: 'Services · Manpower & Equipments Supply', path: '/services/manpower-equipments-supply' },
  { slug: 'services-construction-resources-supply', title: 'Services · Construction Resources Supply', path: '/services/construction-resources-supply' },
  { slug: 'services-facility-management', title: 'Services · Facility Management', path: '/services/facility-management' },
  { slug: 'projects', title: 'Projects', path: '/projects' },
  { slug: 'gallery', title: 'Gallery', path: '/gallery' },
  { slug: 'career', title: 'Career', path: '/career' },
  { slug: 'clients', title: 'Clients', path: '/clients' },
  { slug: 'contact', title: 'Contact', path: '/contact' },
] as const

export type PageSlug = (typeof PAGES)[number]['slug']

export function isPage(slug: string): slug is PageSlug {
  return PAGES.some(p => p.slug === slug)
}

export interface PageDoc {
  slug: PageSlug
  content: Record<string, unknown>
  updatedAt: string
}

const pagePath = (slug: PageSlug) => `anp/pages/${slug}.json`

async function readPage(slug: PageSlug): Promise<{ doc: PageDoc | null; sha: string | null }> {
  const file = await getFile(pagePath(slug))
  if (!file) return { doc: null, sha: null }
  try {
    const parsed = JSON.parse(decode(file.content))
    const content = parsed && typeof parsed.content === 'object' && !Array.isArray(parsed.content) ? parsed.content : {}
    return { doc: { slug, content, updatedAt: String(parsed.updatedAt ?? '') }, sha: file.sha }
  } catch {
    return { doc: null, sha: file.sha }
  }
}

/** The saved page, or null when it has never been saved (the site then uses its defaults). */
export async function getPage(slug: PageSlug): Promise<PageDoc | null> {
  return (await readPage(slug)).doc
}

/** Which pages have saved content, with their last save time. */
export async function listPages() {
  const { branch } = cfg()
  const res = await fetch(`${contentsUrl('anp/pages')}?ref=${branch}`, { headers: ghHeaders(), cache: 'no-store' })
  let saved = new Set<string>()
  if (res.ok) {
    const entries: { name: string }[] = await res.json()
    saved = new Set(entries.map(e => e.name.replace(/\.json$/, '')))
  } else if (res.status !== 404) {
    throw new Error(`GitHub GET anp/pages → ${res.status}: ${await res.text()}`)
  }
  return PAGES.map(p => ({ ...p, saved: saved.has(p.slug) }))
}

// ─── Content validation ──────────────────────────────────────────────────────

const MAX_CONTENT_BYTES = 256 * 1024
const KEY = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Content is free-form, but bounded: plain JSON only, limited depth and size,
 * and string lengths capped so a bad request can't bloat the repo.
 */
function cleanValue(value: unknown, at: string, depth: number): unknown {
  if (depth > 8) throw new ValidationError(`${at}: nested too deeply`)
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ValidationError(`${at}: invalid number`)
    return value
  }
  if (typeof value === 'string') {
    if (value.length > 10000) throw new ValidationError(`${at}: text is too long (max 10000 characters)`)
    return value
  }
  if (Array.isArray(value)) {
    if (value.length > 200) throw new ValidationError(`${at}: too many items (max 200)`)
    return value.map((v, i) => cleanValue(v, `${at}[${i}]`, depth + 1))
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 200) throw new ValidationError(`${at}: too many fields`)
    const out: Record<string, unknown> = {}
    for (const [k, v] of entries) {
      if (!KEY.test(k)) throw new ValidationError(`${at}: invalid field name "${k.slice(0, 40)}"`)
      out[k] = cleanValue(v, at ? `${at}.${k}` : k, depth + 1)
    }
    return out
  }
  throw new ValidationError(`${at}: unsupported value`)
}

function cleanContent(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('content must be an object')
  const content = cleanValue(input, '', 0) as Record<string, unknown>
  for (const url of collectStrings(content)) {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      throw new ValidationError('Upload images through /api/anp/images before saving the page')
    }
  }
  if (Buffer.byteLength(JSON.stringify(content)) > MAX_CONTENT_BYTES) throw new ValidationError('Page content is too large')
  return content
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(v => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(v => collectStrings(v, out))
  return out
}

/** Repo paths of dashboard-uploaded images referenced anywhere in the content. */
function uploadedImages(content: Record<string, unknown> | undefined): Set<string> {
  const base = rawBase()
  const paths = new Set<string>()
  for (const s of collectStrings(content ?? {})) {
    if (s.startsWith(`${base}anp/images/`)) paths.add(s.slice(base.length))
  }
  return paths
}

/**
 * Replaces a page's content. Retries if another save landed between our read and
 * write. Images that were uploaded from the dashboard and are no longer used are
 * removed from the repo afterwards.
 */
export async function savePage(slug: PageSlug, input: unknown): Promise<PageDoc> {
  const content = cleanContent(input)
  for (let attempt = 0; ; attempt++) {
    const { doc: previous, sha } = await readPage(slug)
    const doc: PageDoc = { slug, content, updatedAt: new Date().toISOString() }
    try {
      const body = Buffer.from(JSON.stringify(doc, null, 2), 'utf-8').toString('base64')
      await putFile(pagePath(slug), body, `anp: update ${slug} page`, sha)
    } catch (err) {
      if (err instanceof ShaConflict && attempt < 3) continue
      throw err
    }

    const stillUsed = uploadedImages(content)
    for (const path of uploadedImages(previous?.content)) {
      if (stillUsed.has(path)) continue
      try {
        await deleteFile(path, `anp: remove unused image from ${slug}`)
      } catch (e) {
        // A leftover image is harmless; never fail the save over it.
        console.warn(`[anp] could not delete ${path}:`, e)
      }
    }
    return doc
  }
}

// ─── Images ──────────────────────────────────────────────────────────────────

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** Stores an image in the repo and returns its public URL. */
export async function uploadImage(slug: PageSlug, bytes: Buffer, mime: string): Promise<string> {
  const ext = IMAGE_TYPES[mime]
  if (!ext) throw new ValidationError('Image must be JPG, PNG, WebP, AVIF or GIF')
  if (bytes.length === 0) throw new ValidationError('Image is empty')
  if (bytes.length > MAX_IMAGE_BYTES) throw new ValidationError('Image must be under 4 MB')
  const path = `anp/images/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  await putFile(path, bytes.toString('base64'), `anp: image for ${slug}`)
  return `${rawBase()}${path}`
}
