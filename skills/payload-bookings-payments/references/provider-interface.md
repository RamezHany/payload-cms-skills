# Payment provider interface

Files, all starting with `import 'server-only'` except the type-only module if it is imported by a client schema (keep the schema free of this module):

- `src/features/payments/types.ts`
- `src/features/payments/verify.ts` (the string compare)
- `src/features/payments/get-provider.ts`
- `src/features/payments/providers/<name>.ts`
- `src/features/payments/fulfill.ts` (calendar plus email, called from `after`)
- `src/app/api/webhooks/<provider>/route.ts`

## Types

```ts
import 'server-only'

import type { Booking, Service } from '@/payload-types'

export const PAYMENT_PROVIDERS = ['paymob', 'kashier', 'fawry', 'stripe', 'paypal', 'tap'] as const
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number]

export type CheckoutBooking = Booking & { service: Service | number }

export type CheckoutResult = {
  redirectUrl: string
  providerRef: string
}

export type NormalizedPaymentEvent = {
  provider: PaymentProviderName
  providerEventId: string
  providerRef: string
  kind: 'paid' | 'failed' | 'expired' | 'refunded'
  amountMinor: number
  currency: string
}

export type PaymentProvider = {
  createCheckout: (booking: CheckoutBooking, returnUrl: string) => Promise<CheckoutResult>
  verifyWebhook: (request: Request, rawBody: string) => Promise<NormalizedPaymentEvent | null>
}
```

`verifyWebhook` returns `null` when the signature is missing or wrong. It does not throw for a bad signature.

```ts
import { fawry } from './providers/fawry'
import { kashier } from './providers/kashier'
import { paymob } from './providers/paymob'
import { paypal } from './providers/paypal'
import { stripe } from './providers/stripe'
import { tap } from './providers/tap'

export function getProvider(name: PaymentProviderName): PaymentProvider {
  switch (name) {
    case 'paymob':
      return paymob
    case 'kashier':
      return kashier
    case 'fawry':
      return fawry
    case 'stripe':
      return stripe
    case 'paypal':
      return paypal
    case 'tap':
      return tap
    default: {
      const unhandled: never = name
      throw new Error(`Unhandled provider: ${String(unhandled)}`)
    }
  }
}
```

Imports stay at the top of the module.

## Constant-time compare

```ts
import { timingSafeEqual } from 'node:crypto'

export function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

Lowercase hex digests before comparing. `timingSafeEqual` throws when the lengths differ, so the length check comes first.

Stripe is the exception: call `stripe.webhooks.constructEvent` and do not reimplement its HMAC. The SDK compares the signature in constant time and returns 400 on failure (Stripe's documented status for a bad signature).

## Webhook handler

One route per provider. Do not share a route that parses JSON before the verifier runs.

```ts
import { after } from 'next/server'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const event = await provider.verifyWebhook(request, rawBody)
  if (!event) return new Response('Invalid signature', { status: 401 })

  // A failed or expired checkout leaves the hold. The slot frees itself when holdExpiresAt passes.
  if (event.kind === 'failed' || event.kind === 'expired') return new Response('ok', { status: 200 })

  const payload = await getPayloadClient()
  const inserted = await insertPaymentEvent(payload, event)
  if (inserted === 'duplicate-done') return new Response('ok', { status: 200 })

  if (event.kind === 'refunded') {
    await markRefunded(payload, event)
    return new Response('ok', { status: 200 })
  }

  const booking = await findBooking(payload, event)
  if (!booking) return new Response('ok', { status: 200 })

  if (booking.amountMinor !== event.amountMinor || booking.currency !== event.currency.toUpperCase()) {
    await markNeedsRefund(payload, booking.id)
    return new Response('ok', { status: 200 })
  }

  const confirmed = await confirmIfPending(payload, booking, event.providerRef)
  if (confirmed) {
    after(async () => {
      await fulfillBooking(confirmed.id)
    })
  } else {
    await resolveLatePayment(payload, booking, event)
  }

  return new Response('ok', { status: 200 })
}
```

`fulfillBooking` creates the calendar event and sends the email. It returns immediately when `calendarEventId` is already set, so a recovery retry cannot send a second email.

Log the booking id, provider, `providerEventId`, and whether the compare-and-set changed a row. Do not log `rawBody`, the signature header, or the provider secret.

### Idempotency

1. Create `payment-events` with `outcome: 'received'` and the provider's event id.
2. On a unique violation, load the existing row. If `outcome` is anything other than `received`, return 200 and stop.
3. If `outcome` is still `received` and the booking is still `pending_payment`, continue at the compare-and-set. This covers a crash after the insert. Side effects still run only when the compare-and-set changes one document.
4. After the booking update, set the event `outcome` to `confirmed`, `needs_refund`, `amount_mismatch`, or `ignored`.

A second delivery of a finished event confirms nothing and sends nothing.

### Amount mismatch and refunds

A captured amount or currency that does not match the booking sets `needs_refund`. Email admins once, through the helper defined by `payload-integrations`, when that compare-and-set changes one row. Do not call a refund API from the webhook.

`markRefunded` compare-and-sets `status: 'confirmed'` to `refunded` and sets the event outcome to `confirmed` only when that update changed one document. Email admins once in that case. A refund that arrives before confirmation, or a second delivery, changes nothing else. Do not call the gateway. Each provider reference says where to read the refund call when an admin later issues one.

## Checkout

`createCheckout` receives the booking after it is stored. The return URL is `/{locale}/book/return?token={publicToken}` built from `NEXT_PUBLIC_SERVER_URL` (already used by the site) and `booking.locale`. The webhook URL is `{origin}/api/webhooks/{provider}`.

If `createCheckout` fails, leave the hold. It expires and the slot returns. Do not delete the row inside a second transaction.
