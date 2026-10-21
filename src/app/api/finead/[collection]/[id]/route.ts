import { NextRequest, NextResponse } from 'next/server'
import { deleteItem, isCollection, updateItem } from '@/lib/finead-store'
import { CORS, fail, isAuthorized, json, readBody, unauthorized, unknownCollection } from '@/lib/finead-api'

type Context = { params: Promise<{ collection: string; id: string }> }

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * PATCH /api/finead/:collection/:id — edit fields (requires x-cms-secret)
 * Only the fields sent change. JSON, or multipart with a new `image` file.
 */
export async function PATCH(req: NextRequest, { params }: Context) {
  const { collection, id } = await params
  if (!isCollection(collection)) return unknownCollection()
  if (!isAuthorized(req)) return unauthorized()

  try {
    const { data, image } = await readBody(req)
    const item = await updateItem(collection, id, data, image)
    return json({ item })
  } catch (err) {
    return fail(err)
  }
}

/** DELETE /api/finead/:collection/:id — removes the item and its uploaded image (requires x-cms-secret) */
export async function DELETE(req: NextRequest, { params }: Context) {
  const { collection, id } = await params
  if (!isCollection(collection)) return unknownCollection()
  if (!isAuthorized(req)) return unauthorized()

  try {
    await deleteItem(collection, id)
    return json({ ok: true })
  } catch (err) {
    return fail(err)
  }
}
