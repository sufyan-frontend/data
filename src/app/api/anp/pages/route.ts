import { listPages } from '@/lib/anp-store'
import { fail, json, preflight } from '@/lib/anp-api'

export const OPTIONS = preflight

/** GET /api/anp/pages — every page of the ANP site and whether it has saved content (public). */
export async function GET() {
  try {
    return json({ pages: await listPages() })
  } catch (err) {
    return fail(err)
  }
}
