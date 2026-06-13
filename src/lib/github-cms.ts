/**
 * GitHub CMS — stores posts and images directly in a GitHub repo.
 *
 * Required .env.local variables:
 *   GITHUB_TOKEN   — fine-grained PAT with "Contents: Read and Write" on the target repo
 *   GITHUB_OWNER   — your GitHub username or org (e.g. "ehya-education")
 *   GITHUB_REPO    — repository name (e.g. "ees-cms-data")
 *   GITHUB_BRANCH  — branch to commit to (default: "main")
 *   CMS_SECRET     — secret header value that protects your /api/cms/* routes
 *
 * Repo layout:
 *   posts/{slug}.md      — markdown file with YAML frontmatter
 *   images/{slug}.{ext}  — cover image (max ~1 MB via Contents API)
 *   data.json            — flat index of all posts (title, slug, image, tags, date…)
 *
 * Image URLs for <img src>:
 *   https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/images/{slug}.{ext}
 */

const GH_API = 'https://api.github.com'

interface GHConfig {
  token: string | undefined
  owner: string | undefined
  repo: string | undefined
  branch: string
}

function cfg(): GHConfig {
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

export interface PostEntry {
  slug: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  image: string | null
}

export interface Post extends PostEntry {
  content: string
}

// Returns the public raw URL for any file in the repo.
export function rawUrl(filePath: string): string {
  const { owner, repo, branch } = cfg()
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

// Converts a title to a URL-safe slug.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ─── Low-level GitHub Contents API ──────────────────────────────────────────

interface GHFile {
  content: string
  sha: string
  name: string
  path: string
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
    body: JSON.stringify({
      message,
      content: clean,
      branch,
      ...(sha && { sha }),
    }),
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

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

function buildFrontmatter(meta: Record<string, string | string[]>): string {
  const lines = ['---']
  for (const [k, v] of Object.entries(meta)) {
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(item => `"${String(item)}"`).join(', ')}]`)
    } else {
      lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

function parseFrontmatter(md: string): { meta: Record<string, string | string[]>; content: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, content: md }
  const meta: Record<string, string | string[]> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    const raw = line.slice(i + 1).trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      meta[key] = raw
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else {
      meta[key] = raw.replace(/^["']|["']$/g, '')
    }
  }
  return { meta, content: m[2].trim() }
}

// GitHub wraps base64 content in newlines every 60 chars — strip before decoding.
function decodeGHContent(ghContent: string): string {
  return Buffer.from(ghContent.replace(/\s/g, ''), 'base64').toString('utf-8')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns the full post index from data.json (array of post summaries). */
export async function fetchAllPosts(): Promise<PostEntry[]> {
  const file = await getFile('data.json')
  if (!file) return []
  return JSON.parse(decodeGHContent(file.content))
}

/**
 * Returns a single post with full markdown content.
 */
export async function fetchPostBySlug(slug: string): Promise<Post | null> {
  const file = await getFile(`posts/${slug}.md`)
  if (!file) return null
  const md = decodeGHContent(file.content)
  const { meta, content } = parseFrontmatter(md)
  return {
    slug,
    title: meta.title as string,
    description: meta.description as string,
    date: meta.date as string,
    author: meta.author as string,
    tags: meta.tags as string[],
    image: (meta.image as string) ?? null,
    content,
  }
}

export interface CreatePostInput {
  title: string
  description: string
  content?: string
  imageBase64?: string | null
  imageExt?: string
  tags?: string[]
  author?: string
}

/**
 * Creates a new post in the GitHub repo.
 * imageBase64 should be a raw base64 string or a data-URL (data:image/jpeg;base64,…).
 */
export async function createPost({
  title,
  description,
  content = '',
  imageBase64 = null,
  imageExt = 'jpg',
  tags = [],
  author = '',
}: CreatePostInput): Promise<PostEntry> {
  const slug = slugify(title)
  const date = new Date().toISOString().split('T')[0]

  // 1. Upload cover image
  let imagePath: string | null = null
  if (imageBase64) {
    imagePath = `images/${slug}.${imageExt}`
    await putBase64File(imagePath, imageBase64, `cms: add image for "${slug}"`)
  }

  // 2. Write markdown file
  const frontmatter = buildFrontmatter({
    title, slug, description, date, author,
    tags,
    ...(imagePath && { image: imagePath }),
  })
  await putTextFile(`posts/${slug}.md`, `${frontmatter}\n\n${content}`, `cms: add post "${title}"`)

  // 3. Prepend entry to data.json
  const allPosts = await fetchAllPosts()
  const entry: PostEntry = { slug, title, description, date, author, tags, image: imagePath }
  const existing = allPosts.findIndex(p => p.slug === slug)
  if (existing >= 0) allPosts[existing] = entry
  else allPosts.unshift(entry)
  const dataFile = await getFile('data.json')
  await putTextFile('data.json', JSON.stringify(allPosts, null, 2), `cms: index "${slug}"`, dataFile?.sha)

  return entry
}

export interface UpdatePostInput {
  title: string
  description: string
  content: string
  imageBase64?: string | null
  imageExt?: string
  tags?: string[]
  author?: string
}

/**
 * Updates an existing post. Omit imageBase64 to keep the existing cover image.
 */
export async function updatePost(slug: string, {
  title,
  description,
  content,
  imageBase64 = null,
  imageExt = 'jpg',
  tags = [],
  author = '',
}: UpdatePostInput): Promise<PostEntry> {
  const date = new Date().toISOString().split('T')[0]
  const allPosts = await fetchAllPosts()
  const existing = allPosts.find(p => p.slug === slug)

  // 1. Upload new image if provided; otherwise keep current
  let imagePath: string | null = existing?.image ?? null
  if (imageBase64) {
    imagePath = `images/${slug}.${imageExt}`
    const imgFile = await getFile(imagePath)
    await putBase64File(imagePath, imageBase64, `cms: update image for "${slug}"`, imgFile?.sha)
  }

  // 2. Overwrite markdown file
  const frontmatter = buildFrontmatter({
    title, slug, description, date, author,
    tags,
    ...(imagePath && { image: imagePath }),
  })
  const mdFile = await getFile(`posts/${slug}.md`)
  await putTextFile(`posts/${slug}.md`, `${frontmatter}\n\n${content}`, `cms: update post "${title}"`, mdFile?.sha)

  // 3. Update data.json entry
  const entry: PostEntry = { slug, title, description, date, author, tags, image: imagePath }
  const idx = allPosts.findIndex(p => p.slug === slug)
  if (idx >= 0) allPosts[idx] = entry
  else allPosts.unshift(entry)
  const dataFile = await getFile('data.json')
  await putTextFile('data.json', JSON.stringify(allPosts, null, 2), `cms: re-index "${slug}"`, dataFile?.sha)

  return entry
}

/**
 * Permanently deletes a post: removes the .md file, the cover image, and the data.json entry.
 */
export async function deletePost(slug: string): Promise<void> {
  // 1. Delete markdown
  const mdFile = await getFile(`posts/${slug}.md`)
  if (mdFile) await deleteGHFile(`posts/${slug}.md`, `cms: delete post "${slug}"`, mdFile.sha)

  // 2. Delete image — try all common extensions
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
    const imgFile = await getFile(`images/${slug}.${ext}`)
    if (imgFile) {
      await deleteGHFile(`images/${slug}.${ext}`, `cms: delete image for "${slug}"`, imgFile.sha)
      break
    }
  }

  // 3. Remove from data.json
  const allPosts = await fetchAllPosts()
  const filtered = allPosts.filter(p => p.slug !== slug)
  if (filtered.length !== allPosts.length) {
    const dataFile = await getFile('data.json')
    await putTextFile('data.json', JSON.stringify(filtered, null, 2), `cms: remove "${slug}" from index`, dataFile?.sha)
  }
}
