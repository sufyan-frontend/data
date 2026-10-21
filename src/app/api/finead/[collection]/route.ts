import { NextRequest, NextResponse } from 'next/server'
import { createItem, isCollection, isPublicCollection, listActiveItems, listItems } from '@/lib/finead-store'
import { CORS, fail, isAuthorized, json, readBody, unauthorized, unknownCollection } from '@/lib/finead-api'

type Context = { params: Promise<{ collection: string }> }

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/finead/:collection         — active items (projects, jobs, team are public)
 * GET /api/finead/:collection?all=1   — every item incl. hidden (requires x-cms-secret)
 * GET /api/finead/enquiries           — always requires x-cms-secret
 */
export async function GET(req: NextRequest, { params }: Context) {
  const { collection } = await params
  if (!isCollection(collection)) return unknownCollection()

  const authed = isAuthorized(req)
  if (!isPublicCollection(collection) && !authed) return unauthorized()

  try {
    const wantAll = req.nextUrl.searchParams.get('all') === '1' && authed
    const items = wantAll ? await listItems(collection) : await listActiveItems(collection)
    return json({ items })
  } catch (err) {
    return fail(err)
  }
}

/**
 * POST /api/finead/:collection — create an item (requires x-cms-secret)
 * JSON, or multipart/form-data with an optional `image` file (projects, team).
 */
export async function POST(req: NextRequest, { params }: Context) {
  const { collection } = await params
  if (!isCollection(collection)) return unknownCollection()
  if (!isAuthorized(req)) return unauthorized()

  try {
    const { data, image } = await readBody(req)
    const item = await createItem(collection, data, image)
    return json({ item }, 201)
  } catch (err) {
    return fail(err)
  }
}
