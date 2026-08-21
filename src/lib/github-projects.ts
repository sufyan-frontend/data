/**
 * GitHub Projects store — portfolio projects saved as a single JSON index in the
 * same GitHub repo used by the posts CMS and the reviews store.
 *
 * Reuses the same env vars as github-cms.ts:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 *
 * Repo layout:
 *   projects/projects.json      — flat array of every project (production + practice)
 *   projects/images/{id}.{ext}  — screenshot uploaded through the admin panel
 *
 * The `image` field holds either a full raw.githubusercontent URL (for uploads made
 * here) or a site-relative path such as "/porfolio%20image/ehya-pk.png" (for the
 * screenshots that already live in the frontend's public folder). Consumers must
 * handle both — see the frontend's resolveProjectImage() helper.
 */

import { revalidateFrontendProjects } from './revalidate-frontend'

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

// Public raw URL for a repo file (used for <img src>).
function rawUrl(filePath: string): string {
  const { owner, repo, branch } = cfg()
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

// Converts a full raw URL back to a repo-relative path for GitHub API operations.
// Returns null for site-relative paths, which are not stored in the repo.
function toRepoPath(field: string | null): string | null {
  if (!field) return null
  const { owner, repo, branch } = cfg()
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
  return field.startsWith(base) ? field.slice(base.length) : null
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

async function putTextFile(path: string, text: string, message: string, sha?: string | null): Promise<void> {
  const { branch } = cfg()
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({
      message,
      content: Buffer.from(text, 'utf-8').toString('base64'),
      branch,
      ...(sha && { sha }),
    }),
  })
  if (!res.ok) throw new Error(`GitHub PUT ${path} → ${res.status}: ${await res.text()}`)
}

// base64Content may include a data-URL prefix like "data:image/png;base64,…" — stripped automatically.
async function putBase64File(path: string, base64Content: string, message: string, sha?: string | null): Promise<void> {
  const { branch } = cfg()
  const clean = base64Content.replace(/^data:[^;]+;base64,/, '')
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({ message, content: clean, branch, ...(sha && { sha }) }),
  })
  if (!res.ok) throw new Error(`GitHub PUT ${path} → ${res.status}: ${await res.text()}`)
}

async function deleteGHFile(path: string, message: string, sha: string): Promise<void> {
  const { branch } = cfg()
  const res = await fetch(contentsUrl(path), {
    method: 'DELETE',
    headers: ghHeaders(),
    body: JSON.stringify({ message, sha, branch }),
  })
  if (!res.ok) throw new Error(`GitHub DELETE ${path} → ${res.status}: ${await res.text()}`)
}

// GitHub wraps base64 content in newlines every 60 chars — strip before decoding.
function decodeGHContent(ghContent: string): string {
  return Buffer.from(ghContent.replace(/\s/g, ''), 'base64').toString('utf-8')
}

const PROJECTS_PATH = 'projects/projects.json'
const IMAGE_DIR = 'projects/images'

/** "production" = client work shown in the main grid, "practice" = learning builds. */
export type ProjectKind = 'production' | 'practice'

export interface Project {
  id: string
  title: string
  description: string
  url: string
  image: string | null // raw URL, or a site-relative path for pre-existing screenshots
  tags: string[]
  featured: boolean // surfaced in the home-page teaser
  kind: ProjectKind
  order: number // ascending; controls display order within a kind
  active: boolean // shown on the public site when true
  date: string // ISO timestamp of creation
}

export interface CreateProjectInput {
  title: string
  description: string
  url: string
  tags?: string[]
  featured?: boolean
  kind?: ProjectKind
  active?: boolean
  image?: string | null // site-relative path, used when no file is uploaded
  imageBase64?: string | null
  imageExt?: string
}

// Ensures every stored record has all fields, even if written before they existed.
function normalise(raw: Partial<Project>, index: number): Project {
  const kind: ProjectKind = raw.kind === 'practice' ? 'practice' : 'production'
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    url: String(raw.url ?? ''),
    image: raw.image ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    featured: raw.featured === true,
    kind,
    order: Number.isFinite(raw.order) ? Number(raw.order) : index,
    active: raw.active !== false, // default true when missing
    date: String(raw.date ?? ''),
  }
}

async function readProjects(): Promise<{ list: Project[]; sha: string | null }> {
  const file = await getFile(PROJECTS_PATH)
  if (!file) return { list: [], sha: null }
  try {
    const parsed = JSON.parse(decodeGHContent(file.content))
    const list = Array.isArray(parsed) ? parsed.map(normalise) : []
    list.sort((a, b) => a.order - b.order)
    return { list, sha: file.sha }
  } catch {
    return { list: [], sha: file.sha }
  }
}

// Single choke point for every write (create, update, delete, reorder, import),
// so the frontend cache flush can't be forgotten on a new code path.
async function writeProjects(list: Project[], message: string, sha: string | null): Promise<void> {
  await putTextFile(PROJECTS_PATH, JSON.stringify(list, null, 2), message, sha)
  await revalidateFrontendProjects()
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}

// Converts a title to a URL-safe id.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Normalises a project URL to an absolute URL. Throws when it cannot be parsed.
function normaliseUrl(raw: unknown): string {
  const value = String(raw ?? '').trim()
  if (!value) throw new Error('Project URL is required')
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(withProtocol).toString()
  } catch {
    throw new Error('Project URL is not a valid URL')
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Every project including hidden ones, ordered — for the admin panel. */
export async function fetchAllProjects(): Promise<Project[]> {
  const { list } = await readProjects()
  return list
}

/** Active projects only, ordered — for the public site. */
export async function fetchActiveProjects(): Promise<Project[]> {
  const { list } = await readProjects()
  return list.filter(p => p.active)
}

/** A single project by id, or null when it does not exist. */
export async function fetchProjectById(id: string): Promise<Project | null> {
  const { list } = await readProjects()
  return list.find(p => p.id === id) ?? null
}

/**
 * Creates a project. The id is derived from the title and de-duplicated with a
 * numeric suffix so two projects can never collide in projects.json.
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const title = clean(input.title, 120)
  const description = clean(input.description, 600)
  if (!title) throw new Error('Title is required')
  if (!description) throw new Error('Description is required')
  const url = normaliseUrl(input.url)

  const { list, sha } = await readProjects()

  // De-duplicate the id: "my-site", "my-site-2", "my-site-3", …
  const base = slugify(title) || 'project'
  let id = base
  for (let n = 2; list.some(p => p.id === id); n++) id = `${base}-${n}`

  // Upload the screenshot when one was provided; otherwise keep the given path.
  let image: string | null = input.image ?? null
  if (input.imageBase64) {
    const ext = (input.imageExt || 'png').replace('jpeg', 'jpg')
    const path = `${IMAGE_DIR}/${id}.${ext}`
    await putBase64File(path, input.imageBase64, `projects: image for "${id}"`)
    image = rawUrl(path)
  }

  const kind: ProjectKind = input.kind === 'practice' ? 'practice' : 'production'
  const project: Project = {
    id,
    title,
    description,
    url,
    image,
    tags: (input.tags ?? []).map(t => clean(t, 40)).filter(Boolean).slice(0, 8),
    featured: input.featured === true,
    kind,
    // New projects go to the front of their kind, matching how posts/reviews behave.
    order: (list.length ? Math.min(...list.map(p => p.order)) : 0) - 1,
    active: input.active !== false,
    date: new Date().toISOString(),
  }

  await writeProjects([project, ...list], `projects: add "${title}"`, sha)
  return project
}

export interface UpdateProjectInput {
  title?: string
  description?: string
  url?: string
  tags?: string[]
  featured?: boolean
  kind?: ProjectKind
  active?: boolean
  order?: number
  image?: string | null
  imageBase64?: string | null
  imageExt?: string
}

/** Edits an existing project. Only the fields present in the patch change. */
export async function updateProject(id: string, patch: UpdateProjectInput): Promise<Project> {
  const { list, sha } = await readProjects()
  const idx = list.findIndex(p => p.id === id)
  if (idx < 0) throw new Error('Project not found')

  const next: Project = { ...list[idx] }

  if (patch.title !== undefined) {
    const title = clean(patch.title, 120)
    if (!title) throw new Error('Title is required')
    next.title = title
  }
  if (patch.description !== undefined) {
    const description = clean(patch.description, 600)
    if (!description) throw new Error('Description is required')
    next.description = description
  }
  if (patch.url !== undefined) next.url = normaliseUrl(patch.url)
  if (patch.tags !== undefined) {
    next.tags = patch.tags.map(t => clean(t, 40)).filter(Boolean).slice(0, 8)
  }
  if (patch.featured !== undefined) next.featured = Boolean(patch.featured)
  if (patch.kind !== undefined) next.kind = patch.kind === 'practice' ? 'practice' : 'production'
  if (patch.active !== undefined) next.active = Boolean(patch.active)
  if (patch.order !== undefined && Number.isFinite(Number(patch.order))) {
    next.order = Number(patch.order)
  }
  if (patch.image !== undefined) next.image = patch.image

  // A new upload replaces whatever the image field pointed at before.
  if (patch.imageBase64) {
    const ext = (patch.imageExt || 'png').replace('jpeg', 'jpg')
    const path = `${IMAGE_DIR}/${id}.${ext}`
    const existing = await getFile(path)
    await putBase64File(path, patch.imageBase64, `projects: update image for "${id}"`, existing?.sha)
    next.image = rawUrl(path)
  }

  list[idx] = next
  list.sort((a, b) => a.order - b.order)
  await writeProjects(list, `projects: update "${id}"`, sha)
  return next
}

/** Show/hide a project on the public site. */
export async function setProjectActive(id: string, active: boolean): Promise<Project> {
  return updateProject(id, { active })
}

/**
 * Rewrites the display order from an array of ids (first id gets order 0).
 * Ids not present in the list are ignored; projects missing from `ids` keep
 * their relative position after the ones that were passed.
 */
export async function reorderProjects(ids: string[]): Promise<Project[]> {
  const { list, sha } = await readProjects()
  const position = new Map(ids.map((id, i) => [id, i]))
  const ordered = [...list].sort((a, b) => {
    const pa = position.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const pb = position.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return pa === pb ? a.order - b.order : pa - pb
  })
  ordered.forEach((p, i) => { p.order = i })
  await writeProjects(ordered, 'projects: reorder', sha)
  return ordered
}

/** Permanently removes a project and any screenshot uploaded for it. */
export async function deleteProject(id: string): Promise<void> {
  const { list, sha } = await readProjects()
  const target = list.find(p => p.id === id)
  const filtered = list.filter(p => p.id !== id)
  if (filtered.length === list.length) return

  // Only delete images that actually live in this repo — site-relative paths
  // point at the frontend's public folder and must be left alone.
  const imagePath = toRepoPath(target?.image ?? null)
  if (imagePath) {
    const file = await getFile(imagePath)
    if (file) await deleteGHFile(imagePath, `projects: delete image for "${id}"`, file.sha)
  }

  await writeProjects(filtered, `projects: delete "${id}"`, sha)
}

/**
 * Replaces the whole index in a single commit. Used by scripts/seed-projects.mjs
 * for the initial import — 20 sequential createProject() calls would mean 20
 * commits and 20 round trips.
 */
export async function replaceAllProjects(projects: Project[]): Promise<Project[]> {
  const { sha } = await readProjects()
  const normalised = projects.map(normalise)
  normalised.sort((a, b) => a.order - b.order)
  await writeProjects(normalised, `projects: import ${normalised.length} projects`, sha)
  return normalised
}
