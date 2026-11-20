# Availability, holds, return page, and cron

Files:

- `src/features/booking/schema.ts`
- `src/features/booking/server/slots.ts` (`import 'server-only'` at the top)
- `src/features/booking/queries.ts`
- `src/features/booking/components/BookingForm.tsx`
- `src/app/api/bookings/slots/route.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/status/route.ts`
- `src/app/api/cron/expire-holds/route.ts`
- `src/app/(frontend)/[locale]/book/page.tsx`
- `src/app/(frontend)/[locale]/book/return/page.tsx`

The page files fetch or compose. Slot math and payment calls stay in `src/features`.

## Timezone

Store `startsAt` and `endsAt` as UTC ISO strings. Interpret weekly hours and blackout dates in `booking-settings.timezone`.

`new Date('2026-01-15T09:00:00')` is the server's local zone. Do not use it. Convert a business wall time with this offset correction (apply it twice so a DST gap is resolved):

```ts
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  let hour = pick('hour')
  if (hour === 24) hour = 0
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), hour, pick('minute'), pick('second'))
  return asUtc - instant.getTime()
}

export function zonedTimeToUtc(isoDate: string, isoTime: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  const [hour, minute, second = 0] = isoTime.split(':').map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const corrected = new Date(utcGuess.getTime() - zoneOffsetMs(utcGuess, timeZone))
  return new Date(utcGuess.getTime() - zoneOffsetMs(corrected, timeZone))
}
```

Today's date in the business zone is `new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())`, which yields `YYYY-MM-DD`.

Visitor-facing labels:

```ts
new Intl.DateTimeFormat(locale, {
  timeZone: settings.timezone,
  dateStyle: 'medium',
  timeStyle: 'short',
})
```

`locale` is the route locale on the page, and `booking.locale` in email.

## Slot route

`GET /api/bookings/slots?serviceId=&date=`

1. Parse `date` with `z.iso.date()` and `serviceId` as a positive integer.
2. Load the published service and `booking-settings` with `depth: 0`. No `unstable_cache` and no `'use cache'`.
3. Respond `503` if Google freebusy fails. Do not show slots when the calendar is unknown.
4. Respond with `Cache-Control: no-store`.

A slot starting at business time `T` is returned only when all of these hold:

1. `date` is not in `blackoutDates`.
2. `date` is today or later in the business zone, and not after today plus `maxDaysAhead`.
3. The weekday matches a `weeklyHours` row, and `T + durationMinutes` ends at or before that row's `end`.
4. `T` is on the `slotLengthMinutes` grid from that row's `start`.
5. `T` is at or after now plus `minLeadMinutes`.
6. The range `[T, T + durationMinutes + bufferMinutes)` does not overlap a taken range.

Taken ranges:

- `status === 'confirmed'`: `[startsAt, endsAt + buffer)`
- `status === 'pending_payment'` and `holdExpiresAt > now`: `[startsAt, endsAt + buffer)`
- `pending_payment` whose `holdExpiresAt` is in the past: free, even while status is still `pending_payment`
- `expired`, `cancelled`, `needs_refund`, `refunded`: free

Query bookings for that resource whose `startsAt` is inside the day's UTC bounds. Filter the hold expiry in code so a past `holdExpiresAt` is not treated as busy. Also subtract freebusy ranges from [google-calendar.md](google-calendar.md), each extended by `bufferMinutes` after `end`.

The client query key is `bookingKeys.slots(serviceId, date)`. Set `staleTime: 0` on this query. The shared `QueryProvider` default of 60 seconds is too long for inventory.

## Hold

`POST /api/bookings` body, parsed with the same schema on the server:

```ts
const bookingRequestSchema = z.object({
  serviceId: z.number().int().positive(),
  startsAt: z.iso.datetime(),
  customerName: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.e164(),
  locale: z.enum(locales),
  provider: z.enum(['paymob', 'kashier', 'fawry', 'stripe', 'paypal', 'tap']),
})
```

`locales` comes from `src/i18n/locales.ts`. Ignore any amount, currency, or price in the body.

1. Re-run the slot check for `startsAt`. If it is not available, return 409 `{ error: 'slot_taken' }`.
2. Require `provider` to be in `enabledProviders`.
3. Copy `amountMinor` and `currency` from the service.
4. Set `publicToken` from `randomBytes(32).toString('base64url')`.
5. Set `slotKey` to `` `${resource}:${new Date(startsAt).toISOString()}` ``.
6. Set `holdExpiresAt` from the table below.
7. `payload.create` the booking with `status: 'pending_payment'`.
8. Call `createCheckout`. Save `providerRef`. Return `{ redirectUrl }`.

If create throws, `find` by `slotKey`. When no row exists, return 500 and stop. When a row exists:

1. If it is `pending_payment` and `holdExpiresAt` is in the past, compare-and-set it to `expired` with `slotKey: expired:${id}` and `where` including that id, `status === pending_payment`, and `holdExpiresAt < now`.
2. If `docs.length === 1`, retry the create once.
3. Otherwise return 409. Do not retry again.

### Hold length

| Provider | Rule |
| --- | --- |
| Stripe | Checkout `expires_at` must be at least 30 minutes and at most 24 hours after creation (Checkout Sessions API). Effective hold is `min(max(holdMinutes, 30), 1440)` minutes. Set `holdExpiresAt` and `expires_at` to that same instant |
| Paymob | The client secret expires one hour after the intention (Paymob Pixel docs). `holdMinutes` must be 60 or less |
| Kashier | Set the session `expireAt` to `holdExpiresAt` |
| Fawry | Card 3DS uses `holdMinutes`. Do not enable Pay at Fawry kiosk payment unless the client accepts a hold as long as the reference lifetime |
| PayPal | The approval link can outlive a short hold. Read the sandbox order for its expiry. A capture after the hold uses the late-payment path |
| Tap | `holdMinutes` |

Default `holdMinutes` is 30 so a Stripe-enabled site does not need a second clock.

## Late payment

When a verified paid event arrives and the booking is not `pending_payment` with a live hold:

1. If status is already `confirmed`, return 200 and stop.
2. If status is `expired`, or `pending_payment` with `holdExpiresAt` in the past: search for another booking on the same resource and `startsAt` that is `confirmed`, or `pending_payment` with a future `holdExpiresAt`.
3. When none exists, compare-and-set this booking from `expired` or `pending_payment` to `confirmed` and set `slotKey` back to `` `${resource}:${startsAt ISO}` ``.
4. If that update throws a unique violation or matches zero documents, compare-and-set to `needs_refund` and email admins once.
5. Calendar and customer email run only when the confirming update changed one document.

## Return page

`/{locale}/book/return` reads `token` and polls `GET /api/bookings/status?token=`. The handler looks up `publicToken` and returns `status`, `startsAt`, `endsAt`, the service title, `amountMinor`, `currency`, and `meetUrl` only when status is `confirmed`. Unknown token: 404. `Cache-Control: no-store`.

```ts
refetchInterval: (query) => {
  const status = query.state.data?.status
  if (!status || status === 'pending_payment') return 2000
  return false
}
```

Stop polling after two minutes and show that the payment is still processing and the confirmation will arrive by email. Discard gateway query parameters (`hmac`, `success`, `paymentStatus`, `tap_id`, PayPal tokens). They are not a payment result.

Final statuses are `confirmed`, `expired`, `cancelled`, `needs_refund`, and `refunded`.

## Cron

`vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/expire-holds", "schedule": "0 3 * * *" }]
}
```

Hobby cron jobs run at most once per day, at any time inside that hour. A more frequent expression fails deployment. If the project has migrated to Vercel Schedules, keep one daily path schedule with `requestMethod: "GET"` and the same check. Do not schedule this cleanup more often than daily on Hobby.

```ts
import { timingSafeEqualString } from '@/features/payments/verify'
import { expireStaleHolds } from '@/features/booking/server/expire-holds'

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
```

`expireStaleHolds` is in `src/features/booking/server/expire-holds.ts`. A missing `CRON_SECRET` returns 401. The query is safe to run twice.

```ts
import 'server-only'

import { getPayloadClient } from '@/lib/payload'

export async function expireStaleHolds(): Promise<number> {
  const payload = await getPayloadClient()
  const now = new Date().toISOString()
  const stale = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { status: { equals: 'pending_payment' } },
        { holdExpiresAt: { less_than: now } },
      ],
    },
    depth: 0,
    limit: 100,
    pagination: false,
  })

  let expired = 0
  for (const booking of stale.docs) {
    const updated = await payload.update({
      collection: 'bookings',
      where: {
        and: [
          { id: { equals: booking.id } },
          { status: { equals: 'pending_payment' } },
          { holdExpiresAt: { less_than: now } },
        ],
      },
      data: { status: 'expired', slotKey: `expired:${booking.id}` },
      depth: 0,
      context: { disableRevalidate: true },
    })
    if (updated.docs.length === 1) expired += 1
  }
  return expired
}
```
