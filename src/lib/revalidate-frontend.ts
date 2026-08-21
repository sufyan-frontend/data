/**
 * Tells the portfolio frontend to drop its cached project data after a write.
 *
 * The frontend caches GET /api/cms/projects for 5 minutes under the "projects"
 * cache tag. Without this ping an edit made in the admin panel would not appear
 * on the live site until that window expired.
 *
 * Optional by design: if FRONTEND_URL is not set the call is skipped, so local
 * development and the API keep working with no extra configuration.
 *
 * .env.local:
 *   FRONTEND_URL=http://localhost:3000        # or https://sufyan-frontend.vercel.app
 *   CMS_SECRET=…                              # already shared with the frontend
 */
export async function revalidateFrontendProjects(): Promise<void> {
  const base = process.env.FRONTEND_URL?.replace(/\/$/, '')
  if (!base) return

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cms-secret': process.env.CMS_SECRET ?? '',
      },
      body: JSON.stringify({ tag: 'projects' }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[revalidate] frontend returned ${res.status}: ${await res.text()}`)
    }
  } catch (err) {
    // Never fail the admin write just because the frontend was unreachable —
    // the 5-minute revalidate window is the fallback.
    console.warn(`[revalidate] could not reach ${base}: ${err instanceof Error ? err.message : err}`)
  }
}
