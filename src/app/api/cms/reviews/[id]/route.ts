import { NextRequest, NextResponse } from 'next/server'
import { deleteReview, updateReview } from '@/lib/github-reviews'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-cms-secret',
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-cms-secret') === process.env.CMS_SECRET
}

/** Preflight for cross-origin requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * PATCH /api/cms/reviews/:id — edit fields / toggle visibility  (requires x-cms-secret)
 * JSON body: any subset of { name, rating, company, message, website, active }
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  const { id } = await context.params
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: CORS })
    }
    const review = await updateReview(id, body)
    return NextResponse.json({ review }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isClient = /required|between 1 and 5|not found/i.test(message)
    const status = /not found/i.test(message) ? 404 : isClient ? 400 : 500
    return NextResponse.json({ error: message }, { status, headers: CORS })
  }
}

/** DELETE /api/cms/reviews/:id — removes a review + its avatar  (requires x-cms-secret) */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }
  const { id } = await context.params
  try {
    await deleteReview(id)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
