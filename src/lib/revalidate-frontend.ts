/**
 * Invalidates a tagged cache entry on the portfolio frontend after a CMS write.
 * The frontend endpoint accepts only an allowlist of tags and checks CMS_SECRET.
 */
export async function revalidateFrontendTag(tag: string): Promise<boolean> {
  const base = process.env.FRONTEND_URL?.replace(/\/$/, '')
  const secret = process.env.CMS_SECRET
  if (!base || !secret) return false

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cms-secret': secret,
      },
      body: JSON.stringify({ tag }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[revalidate] frontend returned ${res.status}: ${await res.text()}`)
      return false
    }
    return true
  } catch (err) {
    // Never fail a CMS write just because the frontend is temporarily unreachable.
    console.warn(`[revalidate] could not reach ${base}: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

export async function revalidateFrontendProjects(): Promise<void> {
  await revalidateFrontendTag('projects')
}
