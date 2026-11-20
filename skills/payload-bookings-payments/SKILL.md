---
name: payload-bookings-payments
description: Consultation booking with a server-side slot hold and online payment for Payload CMS 3 and Next.js 16. Gateways are Paymob, Kashier, Fawry, Stripe, PayPal, and Tap, plus Google Calendar with Google Meet and an ICS confirmation email. Use when adding a bookable service, checkout, payment webhook, slot availability, a booking hold, or a refund after a missed slot.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload bookings and payments

One consultant calendar, paid online before the slot is confirmed. The browser return URL never confirms a booking. A verified webhook does, through a compare-and-set on `pending_payment`.

Do not add `transactionOptions` to `@payloadcms/db-sqlite`. libSQL has no safe concurrent transactions. Uniqueness is a unique index. Confirmation is `payload.update` with a `where` on the expected status. Money is integer minor units. Never log secrets, raw webhook bodies, or card data.

## Step 1: Choose gateways

Ask before enabling a provider. Record the choice in `PROJECT.md`.

| Gateway | Use when | Settlement the client must confirm | Test mode | Amount sent to the gateway |
| --- | --- | --- | --- | --- |
| Paymob | Egypt cards and wallets (EGP). Regional accounts exist for UAE, KSA, and Oman | Paymob merchant account, payout currency | Secret key prefix and integration id must both be test | Integer minor units (`amount` in cents) |
| Kashier | Egypt cards and wallets (EGP) | Kashier merchant, payout currency | `test-api.kashier.io` plus test keys | Decimal string in the session body. The order hash coerces `20.00` to `20` |
| Fawry | Egypt cards (EGP) through the charge API with 3DS | FawryPay merchant | `atfawry.fawrystaging.com` | Signature uses a two-decimal string. JSON `amount` matches that value |
| Stripe | International cards. Currencies the Stripe account has enabled | Stripe account country and payout currency | `sk_test_` and a test webhook secret | Integer minor units (`unit_amount`) |
| PayPal | Buyer PayPal balance or card, where PayPal supports the currency | PayPal business account | `api-m.sandbox.paypal.com` | Decimal string (`"10.00"`) |
| Tap | Gulf cards (SAR, AED, QAR, KWD, BHD, OMR, and others Tap enables) | Tap merchant and payout currency | Secret key starting `sk_test_` | Major-unit decimal on the charge. The webhook hash uses a fixed number of decimals |

Details, endpoints, and signature field order: [references/paymob.md](references/paymob.md), [references/kashier.md](references/kashier.md), [references/fawry.md](references/fawry.md), [references/stripe.md](references/stripe.md), [references/paypal.md](references/paypal.md), [references/tap.md](references/tap.md).

Enable only providers the client has credentials for. One default provider on the form is enough; extra providers are a select list fed by `booking-settings.enabledProviders`.

## Step 2: Data model

Follow [references/booking-model.md](references/booking-model.md). Summary:

1. On `services` (created in the `payload-bootstrap` skill), replace major-unit `price` with integer `priceMinor`, and keep `currency` and `durationMinutes`.
2. Add global `booking-settings`: IANA timezone, weekly hours, slot length, buffer, minimum lead time, max days ahead, blackout dates, default currency, enabled providers, hold minutes, calendar resource id.
3. Add collection `bookings` with `slotKey` (unique), status union, `publicToken`, money fields, and provider fields.
4. Add collection `payment-events` with unique `providerEventId`. Store ids, amount, currency, and outcome only.
5. Access follows the matrix in the `payload-auth-rbac` skill. Public create happens only in the route handler, which uses the Local API. `create` on the collection stays closed.
6. Run `pnpm generate:types`.

Currency exponents and `toMinor` / `toMajor` live in that reference. Use them for every gateway. Stripe's current currency guide does not document a three-decimal rounding rule; see the Stripe reference before charging KWD, BHD, OMR, or JOD.

## Step 3: Slots, hold, return page, cron

Follow [references/availability-and-holds.md](references/availability-and-holds.md).

1. `GET /api/bookings/slots` computes slots in the business timezone from settings, confirmed bookings, unexpired holds, and Google Calendar freebusy. `Cache-Control: no-store`. The client uses TanStack Query with `staleTime: 0`.
2. `POST /api/bookings` validates with the shared Zod schema, creates the hold, and returns `{ redirectUrl }`. A unique violation on `slotKey` frees an expired hold once via compare-and-set, then retries once. Any other occupant returns 409.
3. Stripe Checkout `expires_at` must be 30 minutes to 24 hours after creation. When Stripe is enabled, the hold is at least 30 minutes and the Checkout expiry is that same timestamp.
4. `GET /api/bookings/status?token=` is the only status the return page trusts. Poll with `refetchInterval` until a final status, then stop and show a timeout message.
5. `GET /api/cron/expire-holds` flips stale holds to `expired` and tombstones `slotKey`. Hobby cron runs at most once per day. Availability already treats an expired hold as free, so this job is cleanup.

## Step 4: Providers and webhooks

Follow [references/provider-interface.md](references/provider-interface.md). One server-only `PaymentProvider` with an exhaustive `switch`. Each provider file lives in `src/features/payments/providers/`.

Webhook route: `src/app/api/webhooks/<provider>/route.ts`.

1. `await request.text()` before any JSON parse.
2. Verify the signature. Compare with `timingSafeEqual`. A failed check returns 401 and writes nothing.
3. A `failed` or `expired` event returns 200 and writes nothing. A `refunded` event is stored, then compare-and-sets `confirmed` to `refunded`. A `paid` event is stored in `payment-events`. A duplicate `providerEventId` returns 200 with no side effects, except the recovery case in the provider reference.
4. Require the amount and currency to match the booking. A mismatch moves the booking to `needs_refund` and does not confirm it.
5. Compare-and-set `pending_payment` to `confirmed`. Schedule calendar and email only when that update changed one document.
6. A payment for an expired hold confirms only if the slot is still free. Otherwise set `needs_refund` and email admins once.
7. `after()` from `next/server` runs the side effects so the handler can return 200 first.

## Step 5: Calendar, Meet, and email

Follow [references/google-calendar.md](references/google-calendar.md). Ask which Google account type before writing auth.

Send the confirmation through the email helper defined by `payload-integrations`, in `booking.locale`, with an `ics` attachment. Do not add a second email client.

## Step 6: Localization and pages

Pages, not business logic:

- `src/app/(frontend)/[locale]/book/page.tsx`
- `src/app/(frontend)/[locale]/book/return/page.tsx`

API routes stay outside `[locale]`, under `src/app/api/`, so the proxy from the `payload-localization` skill does not rewrite them. Format every visitor-facing date with `Intl.DateTimeFormat` and `timeZone` set to the business timezone. Weekday and hour labels use the page locale. Emails use `booking.locale`, not the webhook's locale.

The booking form uses React Hook Form, `zodResolver`, and `useMutation`. The schema uses `z.email()`, `z.e164()`, `z.iso.datetime()`, and `z.iso.date()`. The route parses the same schema.

## Step 7: Invalidation

`bookings` and `payment-events` are private. Do not register a revalidation hook on them.

`booking-settings` renders on `/book` only. Service pages render `priceMinor` from the service document, so a settings save does not touch them. The service's own publish hook (see the `payload-performance` skill) already regenerates a service page when its price changes.

```ts
import type { GlobalAfterChangeHook } from 'payload'

import { applyRevalidation, localizedPaths } from '@/utilities/revalidation'

export const revalidateBookingSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc
  // Regenerates /book for each locale. Service pages do not read this global.
  applyRevalidation(
    { reason: 'booking-settings', paths: localizedPaths('/book'), tags: [] },
    req.payload,
  )
  return doc
}
```

Copy these rows into the `PROJECT.md` invalidation map (two locales shown):

| Collection or global | Trigger | Paths (per locale) | Tags | Writes per save |
| --- | --- | --- | --- | --- |
| bookings | any | none | none | 0 |
| payment-events | any | none | none | 0 |
| booking-settings | update | /book | none | 1 x locales |
| services | publish of a price or content change | the service page only, via its existing targets | the service's existing tags | unchanged from the service row |

Batch seed writes pass `context: { disableRevalidate: true }`.

## Environment variables

Add the names the enabled providers need to `.env.example`. Leave values empty. Real values stay in `.env` and the host dashboard.

```bash
CRON_SECRET=
PAYMOB_SECRET_KEY=
PAYMOB_PUBLIC_KEY=
PAYMOB_HMAC_SECRET=
PAYMOB_INTEGRATION_IDS=
PAYMOB_API_BASE=
PAYMOB_CHECKOUT_BASE=
KASHIER_MERCHANT_ID=
KASHIER_SECRET_KEY=
KASHIER_API_KEY=
KASHIER_MODE=test
FAWRY_MERCHANT_CODE=
FAWRY_SECURE_KEY=
FAWRY_MODE=sandbox
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox
TAP_SECRET_KEY=
GOOGLE_AUTH_MODE=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
GOOGLE_CALENDAR_OWNER_EMAIL=
GOOGLE_CALENDAR_ID=
```

`PAYMOB_INTEGRATION_IDS` is a comma-separated list of integration ids whose mode matches the secret key. `GOOGLE_AUTH_MODE` is `oauth` or `workspace`. Workspace calendar auth uses `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` from the `payload-integrations` skill. Do not add a second pair for the same service account.

## Stop and ask

Stop and write the question under `## Questions` in `PROJECT.md` when any of these is missing:

- Which providers and currencies, and the settlement currency of each merchant account
- Prices, duration, timezone, weekly hours, lead time, blackout dates, and hold minutes
- API keys, webhook secrets, and sandbox versus live
- Google account type: personal Gmail or Workspace
- Whether a kiosk method (Pay at Fawry) is required. That flow pays hours later and needs a long hold the client must accept
- Refund policy text (the public policy page belongs to `payload-legal-trust`)
- A Stripe, PayPal, or Tap currency the account cannot charge

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Two bookings for one slot | `slotKey` not unique, or the retry freed a live hold | Hold reference |
| Webhook 401 for a real payment | Field order, amount formatting, or raw body re-serialized | That provider's reference |
| Booking stays `pending_payment` after payment | Return URL was trusted, or the webhook is not the server notification | Status poll and webhook route |
| Second email or second Meet link | Side effects ran when compare-and-set changed 0 documents | Provider reference |
| Slot still blocked after the hold | Query treats `holdExpiresAt` in the past as busy | Availability reference |
| Cron deploy fails on Hobby | Schedule runs more than once per day | Daily expression only |
| Stripe session create rejected | `expires_at` under 30 minutes or over 24 hours | Stripe reference |

## Done when

- [ ] `pnpm generate:types` succeeds with `bookings`, `payment-events`, and `booking-settings`
- [ ] Two browsers posting the same slot: one hold, one 409, and one `bookings` row with that `slotKey`
- [ ] Replaying one verified webhook confirms once: one `payment-events` row, one confirmation email, one calendar event
- [ ] A tampered signature returns 401 or 400 and does not change `bookings` or `payment-events`
- [ ] After `holdExpiresAt`, that slot is offered again before the cron runs
- [ ] The return page reaches `confirmed` only after the webhook, not from gateway query parameters
- [ ] A sandbox payment completes for each enabled provider
- [ ] Saving `booking-settings` logs `revalidate (booking-settings)` with only the `/book` paths
- [ ] Saving a booking or a payment event logs no `revalidate` line
