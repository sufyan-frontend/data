#!/usr/bin/env node
/**
 * One-off import of the portfolio projects into the GitHub data repo.
 *
 * Writes scripts/projects-seed.json to projects/projects.json in a SINGLE commit —
 * calling the create endpoint 20 times would mean 20 commits and 20 round trips.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-projects.mjs           # dry run, prints what it would write
 *   node --env-file=.env.local scripts/seed-projects.mjs --write   # actually commits
 *
 * Env (same vars as src/lib/github-projects.ts):
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 *
 * Re-running is safe: the file is replaced wholesale, so the seed file is the
 * source of truth. Anything added through the admin panel afterwards WOULD be
 * overwritten, so only re-run this for a deliberate re-import.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED_FILE = resolve(HERE, 'projects-seed.json')
const TARGET_PATH = 'projects/projects.json'
const GH_API = 'https://api.github.com'

const WRITE = process.argv.includes('--write')

const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

const missing = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter(k => !process.env[k])
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`)
  console.error('Run with:  node --env-file=.env.local scripts/seed-projects.mjs')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
}
const contentsUrl = path => `${GH_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`

// ── Validate the seed file before touching the network ───────────────────────
const projects = JSON.parse(readFileSync(SEED_FILE, 'utf-8'))
if (!Array.isArray(projects) || projects.length === 0) {
  console.error(`${SEED_FILE} is empty or not an array`)
  process.exit(1)
}

const REQUIRED = ['id', 'title', 'description', 'url', 'tags', 'featured', 'kind', 'order', 'active', 'date']
const seen = new Set()
for (const [i, p] of projects.entries()) {
  const absent = REQUIRED.filter(k => p[k] === undefined)
  if (absent.length) {
    console.error(`projects[${i}] (${p.id ?? '?'}) is missing: ${absent.join(', ')}`)
    process.exit(1)
  }
  if (seen.has(p.id)) {
    console.error(`Duplicate id "${p.id}" at index ${i}`)
    process.exit(1)
  }
  seen.add(p.id)
  if (p.kind !== 'production' && p.kind !== 'practice') {
    console.error(`projects[${i}] (${p.id}) has invalid kind "${p.kind}"`)
    process.exit(1)
  }
}

projects.sort((a, b) => a.order - b.order)

const production = projects.filter(p => p.kind === 'production')
const practice = projects.filter(p => p.kind === 'practice')
console.log(`Seed file OK — ${projects.length} projects`)
console.log(`  production: ${production.length}  (featured: ${production.filter(p => p.featured).length})`)
console.log(`  practice:   ${practice.length}`)
console.log(`  target:     ${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_BRANCH} → ${TARGET_PATH}`)

// ── Look up the current file so we can pass its sha (required to overwrite) ──
const existing = await fetch(`${contentsUrl(TARGET_PATH)}?ref=${GITHUB_BRANCH}`, {
  headers,
  cache: 'no-store',
})
let sha = null
if (existing.ok) {
  const file = await existing.json()
  sha = file.sha
  const current = JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf-8'))
  console.log(`  existing:   ${Array.isArray(current) ? current.length : '?'} projects (will be replaced)`)
} else if (existing.status === 404) {
  console.log('  existing:   none — creating the file')
} else {
  console.error(`GitHub GET failed → ${existing.status}: ${await existing.text()}`)
  process.exit(1)
}

if (WRITE) {
  const res = await fetch(contentsUrl(TARGET_PATH), {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `projects: import ${projects.length} projects from portfolio data`,
      content: Buffer.from(JSON.stringify(projects, null, 2), 'utf-8').toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha && { sha }),
    }),
  })

  if (!res.ok) {
    console.error(`GitHub PUT failed → ${res.status}: ${await res.text()}`)
    process.exit(1)
  }

  const { commit } = await res.json()
  console.log(`\nWrote ${projects.length} projects to ${TARGET_PATH}`)
  console.log(`Commit: ${commit?.sha?.slice(0, 7) ?? '(unknown)'} — ${commit?.html_url ?? ''}`)
} else {
  console.log('\nDry run — nothing was written. Re-run with --write to commit.')
}
