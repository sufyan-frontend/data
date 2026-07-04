import { NextRequest, NextResponse } from 'next/server'
import { fetchActiveReviews, fetchAllReviews, createReview } from '@/lib/github-reviews'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
 * GET /api/cms/reviews          — active reviews only (public)
 * GET /api/cms/reviews?all=1    — all reviews incl. hidden (requires x-cms-secret)
 */
export async function GET(req: NextRequest) {
  try {
    const wantAll = req.nextUrl.searchParams.get('all') === '1'
    const reviews = wantAll && isAuthorized(req)
      ? await fetchAllReviews()
      : await fetchActiveReviews()
    return NextResponse.json({ reviews }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

/**
 * POST /api/cms/reviews — submit a new review (public, no secret required).
 *
 * multipart/form-data fields:
 *   name         string  (required)
 *   rating       number  (required, 1-5)
 *   company      string  (required)
 *   message      string  (required)
 *   website      string  (optional)
 *   image        File    (optional profile photo, max ~1 MB)
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const imageFile = form.get('image') as File | null

    let imageBase64: string | null = null
    let imageExt = 'jpg'
    if (imageFile && typeof imageFile !== 'string' && imageFile.size > 0) {
      if (imageFile.size > 3 * 1024 * 1024) {
        return NextResponse.json({ error: 'Profile photo must be under 3 MB' }, { status: 400, headers: CORS })
      }
      imageBase64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')
      imageExt = (imageFile.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    }

    const review = await createReview({
      name: form.get('name') as string,
      rating: Number(form.get('rating')),
      company: form.get('company') as string,
      message: form.get('message') as string,
      website: form.get('website') as string,
      imageBase64,
      imageExt,
    })
    return NextResponse.json({ review }, { status: 201, headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isValidation = /required|between 1 and 5|under 3 MB/i.test(message)
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500, headers: CORS })
  }
}
