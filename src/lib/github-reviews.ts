/**
 * GitHub Reviews store — client testimonials saved as a single JSON file in the
 * same GitHub repo used by the posts CMS. Profile photos are stored alongside.
 *
 * Reuses the same env vars as github-cms.ts:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 *
 * Repo layout:
 *   reviews.json                 — flat array of all reviews (newest first)
 *   review-avatars/{id}.{ext}    — optional profile photo per review
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

// Public raw URL for a repo file (used for <img src>).
function rawUrl(filePath: string): string {
  const { owner, repo, branch } = cfg()
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

// Converts a full raw URL back to a repo-relative path for GitHub API operations.
function toRelativePath(field: string | null): string | null {
  if (!field) return null
  const { owner, repo, branch } = cfg()
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
  return field.startsWith(base) ? field.slice(base.length) : field
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

// base64Content may include a data-URL prefix like "data:image/jpeg;base64,…" — stripped automatically.
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

const REVIEWS_PATH = 'reviews.json'
const AVATAR_DIR = 'review-avatars'

export interface Review {
  id: string
  name: string
  rating: number        // 1–5
  company: string
  message: string       // the review text / project description
  website: string | null
  avatar: string | null // raw URL to the reviewer's profile photo
  active: boolean        // shown on the public site when true
  date: string           // ISO timestamp
}

export interface CreateReviewInput {
  name: string
  rating: number
  company: string
  message: string
  website?: string | null
  imageBase64?: string | null
  imageExt?: string
}

// Ensures every stored record has the newer fields, even if written before they existed.
function normalise(raw: Partial<Review>): Review {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    rating: Number(raw.rating ?? 0),
    company: String(raw.company ?? ''),
    message: String(raw.message ?? ''),
    website: raw.website ?? null,
    avatar: raw.avatar ?? null,
    active: raw.active !== false, // default true when missing
    date: String(raw.date ?? ''),
  }
}

async function readReviews(): Promise<{ list: Review[]; sha: string | null }> {
  const file = await getFile(REVIEWS_PATH)
  if (!file) return { list: [], sha: null }
  try {
    const parsed = JSON.parse(decodeGHContent(file.content))
    return { list: Array.isArray(parsed) ? parsed.map(normalise) : [], sha: file.sha }
  } catch {
    return { list: [], sha: file.sha }
  }
}

async function writeReviews(list: Review[], message: string, sha: string | null): Promise<void> {
  await putTextFile(REVIEWS_PATH, JSON.stringify(list, null, 2), message, sha)
}

/** All reviews (newest first) — for the admin panel. */
export async function fetchAllReviews(): Promise<Review[]> {
  const { list } = await readReviews()
  return list
}

/** Only active reviews — for the public site. */
export async function fetchActiveReviews(): Promise<Review[]> {
  const { list } = await readReviews()
  return list.filter(r => r.active)
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}

// Normalises a website field to a valid absolute URL, or null when empty/invalid.
function normaliseWebsite(raw: unknown): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(withProtocol).toString()
  } catch {
    return null
  }
}

/**
 * Validates and stores a new review. Public — anyone can submit.
 * Throws an Error with a user-friendly message on invalid input.
 */
export async function createReview(input: CreateReviewInput): Promise<Review> {
  const name = clean(input.name, 80)
  const company = clean(input.company, 100)
  const message = clean(input.message, 1000)
  const rating = Math.round(Number(input.rating))

  if (!name) throw new Error('Name is required')
  if (!company) throw new Error('Company is required')
  if (!message) throw new Error('Review description is required')
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5 stars')
  }

  const now = new Date()
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`

  // Upload avatar if provided.
  let avatar: string | null = null
  if (input.imageBase64) {
    const ext = (input.imageExt || 'jpg').replace('jpeg', 'jpg')
    const path = `${AVATAR_DIR}/${id}.${ext}`
    await putBase64File(path, input.imageBase64, `reviews: avatar for "${name}"`)
    avatar = rawUrl(path)
  }

  const review: Review = {
    id,
    name,
    rating,
    company,
    message,
    website: normaliseWebsite(input.website),
    avatar,
    active: true,
    date: now.toISOString(),
  }

  const { list, sha } = await readReviews()
  await writeReviews([review, ...list], `reviews: add review from "${name}"`, sha)
  return review
}

export interface UpdateReviewInput {
  name?: string
  rating?: number
  company?: string
  message?: string
  website?: string | null
  active?: boolean
}

/** Edits fields of an existing review (admin). Only provided fields change. */
export async function updateReview(id: string, patch: UpdateReviewInput): Promise<Review> {
  const { list, sha } = await readReviews()
  const idx = list.findIndex(r => r.id === id)
  if (idx < 0) throw new Error('Review not found')

  const current = list[idx]
  const next: Review = { ...current }

  if (patch.name !== undefined) {
    const name = clean(patch.name, 80)
    if (!name) throw new Error('Name is required')
    next.name = name
  }
  if (patch.company !== undefined) {
    const company = clean(patch.company, 100)
    if (!company) throw new Error('Company is required')
    next.company = company
  }
  if (patch.message !== undefined) {
    const message = clean(patch.message, 1000)
    if (!message) throw new Error('Review description is required')
    next.message = message
  }
  if (patch.rating !== undefined) {
    const rating = Math.round(Number(patch.rating))
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5 stars')
    }
    next.rating = rating
  }
  if (patch.website !== undefined) next.website = normaliseWebsite(patch.website)
  if (patch.active !== undefined) next.active = Boolean(patch.active)

  list[idx] = next
  await writeReviews(list, `reviews: update review ${id}`, sha)
  return next
}

/** Show/hide a review on the public site (admin). */
export async function setReviewActive(id: string, active: boolean): Promise<Review> {
  return updateReview(id, { active })
}

/** Permanently removes a review and its avatar image (admin). */
export async function deleteReview(id: string): Promise<void> {
  const { list, sha } = await readReviews()
  const target = list.find(r => r.id === id)
  const filtered = list.filter(r => r.id !== id)
  if (filtered.length === list.length) return

  // Remove avatar image if there was one.
  const avatarPath = toRelativePath(target?.avatar ?? null)
  if (avatarPath) {
    const imgFile = await getFile(avatarPath)
    if (imgFile) await deleteGHFile(avatarPath, `reviews: delete avatar for ${id}`, imgFile.sha)
  }

  await writeReviews(filtered, `reviews: delete review ${id}`, sha)
}
