import { NextRequest, NextResponse } from 'next/server'
import { isCollection, reorderItems } from '@/lib/finead-store'
import { CORS, fail, isAuthorized, json, unauthorized, unknownCollection } from '@/lib/finead-api'

type Context = { params: Promise<{ collection: string }> }

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * POST /api/finead/:collection/reorder — set display order (requires x-cms-secret)
 * JSON body: { ids: string[] }
 */
export async function POST(req: NextRequest, { params }: Context) {
  const { collection } = await params
  if (!isCollection(collection)) return unknownCollection()
  if (!isAuthorized(req)) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.ids)) return json({ error: 'Body must be { ids: string[] }' }, 400)
    const items = await reorderItems(collection, body.ids.map(String))
    return json({ items })
  } catch (err) {
    return fail(err)
  }
}
