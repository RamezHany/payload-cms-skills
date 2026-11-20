# Stripe

Sources checked: [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create), [Supported currencies](https://docs.stripe.com/currencies), and [webhook signature verification](https://docs.stripe.com/webhooks). Package `stripe` at the version in `versions.json`. Server-only. Never import it from a client component.

## Credentials

The client supplies the secret key (`sk_test_` or `sk_live_`) and the webhook signing secret (`whsec_`, from the Dashboard endpoint or from `stripe listen` in local development). Dashboard: Developers, Webhooks, endpoint `https://<host>/api/webhooks/stripe`.

Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.

Test cards are the ones on Stripe's testing page (`https://docs.stripe.com/testing`). The published success card is `4242424242424242` with any future expiry and any CVC.

## Create checkout

```ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const holdMs = Math.min(Math.max(holdMinutes, 30), 24 * 60) * 60 * 1000
const expiresAt = Math.floor((Date.now() + holdMs) / 1000)

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  client_reference_id: booking.publicToken,
  customer_email: booking.email,
  expires_at: expiresAt,
  success_url: returnUrl,
  cancel_url: cancelUrl,
  metadata: { bookingId: String(booking.id) },
  line_items: [
    {
      quantity: 1,
      price_data: {
        currency: booking.currency.toLowerCase(),
        unit_amount: booking.amountMinor,
        product_data: { name: serviceTitle },
      },
    },
  ],
})
```

`expires_at` is a Unix timestamp in seconds. Stripe rejects a value under 30 minutes or over 24 hours from creation. The default when omitted is 24 hours, which is too long for a slot. Set `holdExpiresAt` to the same instant (`expiresAt * 1000`).

`session.url` is the redirect. `session.id` is `providerRef`.

`unit_amount` is integer minor units. `1000` charges 10.00 in a two-decimal currency. For KWD, BHD, OMR, and JOD, send `amountMinor` using exponent 3 (`1.500` KWD is `1500`). The Supported currencies page, as checked for this skill, does not require those amounts to be a multiple of 10. If Stripe returns an error that the amount must be divisible by 10, stop and ask. Do not round the price down on your own.

Currency must be enabled on the Stripe account. A Gulf or Egyptian account often cannot present every currency in the table.

## Return URL

`success_url` can include `{CHECKOUT_SESSION_ID}` if you want it in the query. Do not retrieve the session in the browser and do not confirm from `success_url`. The return page polls our status route.

## Webhook

```ts
const rawBody = await request.text()
const signature = request.headers.get('stripe-signature')
if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return null

try {
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  // map event to NormalizedPaymentEvent
} catch {
  return null
}
```

Catch `constructEvent` errors and return null. The shared webhook handler then responds 401. Stripe's own examples use 400 for a bad signature. Either status rejects the body and changes nothing; this skill uses 401 for every provider so the check is the same.

`providerEventId` is `event.id`.

| Event | Action |
| --- | --- |
| `checkout.session.completed` with `payment_status === 'paid'` | Paid. `amount_total` is minor units. `currency` is lowercase. `client_reference_id` is `publicToken` |
| `checkout.session.completed` with `payment_status === 'unpaid'` | Async method. Do not confirm. Wait for `async_payment_succeeded` |
| `checkout.session.async_payment_succeeded` | Paid, same amount fields |
| `checkout.session.async_payment_failed` or `checkout.session.expired` | Not paid. Leave the hold to expire |

Compare `amount_total` to `amountMinor` and `currency.toUpperCase()` to `booking.currency`.

## Refunds

Do not refund from the webhook. An admin refund uses the Stripe Dashboard or `stripe.refunds.create` after you read the current refunds API. A `charge.refunded` event, if you subscribe later, must not send a second confirmation.

## Common errors

| Symptom | Cause |
| --- | --- |
| `expires_at` invalid | Less than 30 minutes or more than 24 hours ahead |
| Signature verification failed | Body was reparsed, or the webhook secret is from another endpoint |
| `amount_total` off by 100 | Major units were sent as `unit_amount` |
| Currency rejected | Not enabled on the account, or a three-decimal amount the account still rounds |
