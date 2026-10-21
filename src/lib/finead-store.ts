/**
 * Finead store — data for the Finead Communication website (finead-communication.vercel.app),
 * kept in the same GitHub repo as the posts/projects/reviews CMS.
 *
 * Reuses the same env vars as github-cms.ts:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 *
 * Repo layout:
 *   finead/{collection}.json              — flat array per collection (display order)
 *   finead/images/{collection}/{id}-{t}.{ext} — uploaded photos (timestamped so the
 *                                            raw.githubusercontent CDN never serves a stale copy)
 *
 * Collections:
 *   enquiries — contact form submissions (private, newest first)
 *   projects  — portfolio entries
 *   jobs      — open roles on the careers page
 *   team      — crews / people on the team page
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

function rawUrl(filePath: string): string {
  const { owner, repo, branch } = cfg()
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

// Converts a raw URL back to a repo-relative path, or null for external URLs.
function repoPath(url: string | null): string | null {
  if (!url) return null
  const { owner, repo, branch } = cfg()
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
  return url.startsWith(base) ? url.slice(base.length) : null
}

interface GHFile {
  content: string
  sha: string
}

async function getFile(path: string): Promise<GHFile | null> {
  const { branch } = cfg()
  const res = await fetch(`${contentsUrl(path)}?ref=${branch}`, {
    headers: ghHeaders(),
    cache: 'no-store',
  })
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
  // 409/422 mean the file changed since we read it (two writes at once).
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

// ─── Collections & validation ────────────────────────────────────────────────

type FieldSpec =
  | { type: 'string'; max: number; required?: boolean }
  | { type: 'email'; required?: boolean }
  | { type: 'url' }
  | { type: 'list'; max: number }
  | { type: 'enum'; values: readonly string[]; default: string }

const COLLECTIONS = {
  enquiries: {
    public: false,
    newestFirst: true,
    hasImage: false,
    fields: {
      name: { type: 'string', max: 80, required: true },
      company: { type: 'string', max: 100 },
      email: { type: 'email', required: true },
      phone: { type: 'string', max: 30 },
      service: { type: 'string', max: 80 },
      serviceTitle: { type: 'string', max: 120 },
      message: { type: 'string', max: 3000, required: true },
      status: { type: 'enum', values: ['new', 'contacted', 'won', 'closed'], default: 'new' },
      notes: { type: 'string', max: 2000 },
    },
  },
  projects: {
    public: true,
    newestFirst: false,
    hasImage: true,
    fields: {
      title: { type: 'string', max: 120, required: true },
      discipline: { type: 'enum', values: ['advertising', 'branding', 'renovation'], default: 'advertising' },
      service: { type: 'string', max: 80, required: true },
      location: { type: 'string', max: 120 },
      year: { type: 'string', max: 10 },
      summary: { type: 'string', max: 400, required: true },
      image: { type: 'url' },
      imageAlt: { type: 'string', max: 160 },
    },
  },
  jobs: {
    public: true,
    newestFirst: false,
    hasImage: false,
    fields: {
      title: { type: 'string', max: 120, required: true },
      team: { type: 'string', max: 80 },
      type: { type: 'string', max: 80 },
      summary: { type: 'string', max: 500, required: true },
      duties: { type: 'list', max: 12 },
      needs: { type: 'list', max: 12 },
    },
  },
  team: {
    public: true,
    newestFirst: false,
    hasImage: true,
    fields: {
      name: { type: 'string', max: 80, required: true },
      role: { type: 'string', max: 120, required: true },
      bio: { type: 'string', max: 600 },
      image: { type: 'url' },
      imageAlt: { type: 'string', max: 160 },
    },
  },
} as const satisfies Record<string, { public: boolean; newestFirst: boolean; hasImage: boolean; fields: Record<string, FieldSpec> }>

export type CollectionName = keyof typeof COLLECTIONS

export function isCollection(name: string): name is CollectionName {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, name)
}

export function isPublicCollection(name: CollectionName): boolean {
  return COLLECTIONS[name].public
}

export interface FineadItem {
  id: string
  active: boolean
  createdAt: string
  updatedAt: string
  [field: string]: unknown
}

/** Thrown for bad input; API routes map it to HTTP 400. */
export class ValidationError extends Error {}
/** Thrown when an id does not exist; API routes map it to HTTP 404. */
export class NotFoundError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cleanField(key: string, spec: FieldSpec, raw: unknown): unknown {
  switch (spec.type) {
    case 'string': {
      const value = String(raw ?? '').trim().slice(0, spec.max)
      if (spec.required && !value) throw new ValidationError(`${key} is required`)
      return value
    }
    case 'email': {
      const value = String(raw ?? '').trim().slice(0, 160)
      if (spec.required && !value) throw new ValidationError(`${key} is required`)
      if (value && !EMAIL.test(value)) throw new ValidationError(`${key} must be a valid email`)
      return value
    }
    case 'url': {
      const value = String(raw ?? '').trim()
      if (!value) return null
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
        return url.toString()
      } catch {
        throw new ValidationError(`${key} must be a valid URL`)
      }
    }
    case 'list': {
      const items = Array.isArray(raw) ? raw : String(raw ?? '').split('\n')
      return items.map(item => String(item).trim().slice(0, 200)).filter(Boolean).slice(0, spec.max)
    }
    case 'enum': {
      const value = String(raw ?? '').trim()
      if (!value) return spec.default
      if (!spec.values.includes(value)) throw new ValidationError(`${key} must be one of ${spec.values.join(', ')}`)
      return value
    }
  }
}

/** Validates input. With `partial`, only keys present in `input` are checked and returned. */
function sanitise(name: CollectionName, input: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(COLLECTIONS[name].fields) as [string, FieldSpec][]) {
    if (partial && !(key in input)) continue
    out[key] = cleanField(key, spec, input[key])
  }
  if ('active' in input) out.active = input.active === true || input.active === 'true' || input.active === 'on'
  return out
}

// ─── Read / write ────────────────────────────────────────────────────────────

const filePath = (name: CollectionName) => `finead/${name}.json`

async function read(name: CollectionName): Promise<{ list: FineadItem[]; sha: string | null }> {
  const file = await getFile(filePath(name))
  if (!file) return { list: [], sha: null }
  try {
    const parsed = JSON.parse(decode(file.content))
    return { list: Array.isArray(parsed) ? parsed : [], sha: file.sha }
  } catch {
    return { list: [], sha: file.sha }
  }
}

/**
 * Read-modify-write with a retry: if another request wrote the file between our
 * read and write, GitHub rejects the stale sha and we simply redo the change.
 */
async function mutate<T>(
  name: CollectionName,
  message: string,
  change: (list: FineadItem[]) => { list: FineadItem[]; result: T },
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const { list, sha } = await read(name)
    const { list: next, result } = change(list)
    try {
      const body = Buffer.from(JSON.stringify(next, null, 2), 'utf-8').toString('base64')
      await putFile(filePath(name), body, message, sha)
      return result
    } catch (err) {
      if (err instanceof ShaConflict && attempt < 3) continue
      throw err
    }
  }
}

export interface ImageUpload {
  base64: string
  ext: string
}

async function uploadImage(name: CollectionName, id: string, image: ImageUpload): Promise<string> {
  const ext = image.ext.toLowerCase().replace('jpeg', 'jpg')
  if (!['jpg', 'png', 'webp', 'avif'].includes(ext)) throw new ValidationError('Image must be JPG, PNG, WebP or AVIF')
  const path = `finead/images/${name}/${id}-${Date.now()}.${ext}`
  await putFile(path, image.base64.replace(/^data:[^;]+;base64,/, ''), `finead: image for ${name}/${id}`)
  return rawUrl(path)
}

async function removeImage(url: unknown, name: CollectionName, id: string): Promise<void> {
  const path = repoPath(typeof url === 'string' ? url : null)
  if (!path) return
  try {
    await deleteFile(path, `finead: remove image for ${name}/${id}`)
  } catch (err) {
    // A leftover image is harmless; never fail the main write over it.
    console.warn(`[finead] could not delete ${path}:`, err)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Every item, including hidden ones (admin). */
export async function listItems(name: CollectionName): Promise<FineadItem[]> {
  return (await read(name)).list
}

/** Only items switched on (public site). */
export async function listActiveItems(name: CollectionName): Promise<FineadItem[]> {
  return (await read(name)).list.filter(item => item.active !== false)
}

export async function createItem(
  name: CollectionName,
  input: Record<string, unknown>,
  image?: ImageUpload | null,
): Promise<FineadItem> {
  const data = sanitise(name, input, false)
  const now = new Date()
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  if (image && COLLECTIONS[name].hasImage) data.image = await uploadImage(name, id, image)

  const item: FineadItem = {
    ...data,
    id,
    active: data.active === undefined ? true : Boolean(data.active),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  return mutate(name, `finead: add ${name} item ${id}`, list => ({
    list: COLLECTIONS[name].newestFirst ? [item, ...list] : [...list, item],
    result: item,
  }))
}

export async function updateItem(
  name: CollectionName,
  id: string,
  input: Record<string, unknown>,
  image?: ImageUpload | null,
): Promise<FineadItem> {
  const patch = sanitise(name, input, true)
  let replacedImage: unknown = null
  if (image && COLLECTIONS[name].hasImage) patch.image = await uploadImage(name, id, image)

  const updated = await mutate(name, `finead: update ${name} item ${id}`, list => {
    const idx = list.findIndex(item => item.id === id)
    if (idx < 0) throw new NotFoundError(`${name} item not found`)
    if ('image' in patch && patch.image !== list[idx].image) replacedImage = list[idx].image
    const next = { ...list[idx], ...patch, id, updatedAt: new Date().toISOString() }
    const copy = [...list]
    copy[idx] = next
    return { list: copy, result: next }
  })
  if (replacedImage) await removeImage(replacedImage, name, id)
  return updated
}

export async function deleteItem(name: CollectionName, id: string): Promise<void> {
  const removed = await mutate(name, `finead: delete ${name} item ${id}`, list => ({
    list: list.filter(item => item.id !== id),
    result: list.find(item => item.id === id) ?? null,
  }))
  if (removed) await removeImage(removed.image, name, id)
}

/** Rewrites display order. Ids not listed keep their relative order at the end. */
export async function reorderItems(name: CollectionName, ids: string[]): Promise<FineadItem[]> {
  return mutate(name, `finead: reorder ${name}`, list => {
    const byId = new Map(list.map(item => [item.id, item]))
    const ordered = ids.map(id => byId.get(id)).filter((item): item is FineadItem => Boolean(item))
    const rest = list.filter(item => !ids.includes(item.id))
    const next = [...ordered, ...rest]
    return { list: next, result: next }
  })
}
