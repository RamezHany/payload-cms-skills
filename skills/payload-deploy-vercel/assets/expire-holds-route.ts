import type { NextRequest } from 'next/server'

import { timingSafeEqualString } from '@/features/payments/verify'

export const maxDuration = 60

export function GET(request: NextRequest): Response {
  const expected = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!expected || !timingSafeEqualString(header, `Bearer ${expected}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Expire holds here, using the loop in the bookings availability reference:
  // pending_payment whose holdExpiresAt is in the past, limit 100,
  // compare-and-set status to expired and slotKey to `expired:${id}`,
  // context: { disableRevalidate: true }. No emails.
  // The query must be safe to run twice.
  return Response.json({ ok: true })
}
