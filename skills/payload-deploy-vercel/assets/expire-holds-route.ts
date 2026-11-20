import { expireStaleHolds } from '@/features/booking/server/expire-holds'
import { timingSafeEqualString } from '@/features/payments/verify'

export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!expected || !timingSafeEqualString(header, `Bearer ${expected}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const expired = await expireStaleHolds()
  return Response.json({ ok: true, expired })
}
