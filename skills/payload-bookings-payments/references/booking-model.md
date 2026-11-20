# Booking data model

Paths follow the `project-architecture` skill: `src/collections/Services/index.ts` (or the existing services file), `src/collections/Bookings/index.ts`, `src/collections/PaymentEvents/index.ts`, `src/globals/BookingSettings/config.ts`, `src/features/booking/money.ts`.

SQLite ids are numbers. Narrow a relationship with `typeof value === 'object'` before reading fields. Do not set `transactionOptions` on the database adapter.

## Services

The `payload-bootstrap` skill defines `services.priceMinor` as integer minor units. If an existing collection still has major-unit `price`, replace that field with `priceMinor` before any booking is created. Do not keep both.

```ts
{ name: 'priceMinor', type: 'number', required: true, min: 0, admin: { description: 'Integer minor units. 150.00 EGP is 15000. 1.500 KWD is 1500.' } },
{
  name: 'currency',
  type: 'select',
  required: true,
  options: ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD'],
},
{ name: 'durationMinutes', type: 'number', required: true, min: 15 },
```

`title` and `description` stay localized. Price, currency, and duration do not. Access stays admin/editor write, sales read, public read of published docs, as in the `payload-auth-rbac` skill.

## booking-settings

Slug `booking-settings`. Group `Settings`.

| Field | Type | Notes |
| --- | --- | --- |
| timezone | text, required | IANA name. Validate with `Intl.DateTimeFormat(..., { timeZone })` inside try/catch. Ask the client; do not invent a city |
| weeklyHours | array | `day` select `sun` through `sat`; `start` and `end` text stored as `HH:mm:ss`, parsed with `z.iso.time()` |
| slotLengthMinutes | number, required | Grid step. Default 30. Min 5 |
| bufferMinutes | number, required | Gap after an occupied range. Default 0. Min 0 |
| minLeadMinutes | number, required | Earliest bookable instant is now plus this. Default 120 |
| maxDaysAhead | number, required | Last bookable date in the business timezone. Default 30. Min 1 |
| blackoutDates | array of text | `YYYY-MM-DD` in the business timezone, parsed with `z.iso.date()` |
| defaultCurrency | select | Same options as services |
| enabledProviders | select, hasMany | `paymob`, `kashier`, `fawry`, `stripe`, `paypal`, `tap` |
| holdMinutes | number, required | Default 30. See the hold reference for per-provider limits |
| resource | text, required | Default `primary`. One consultant uses one resource. `slotKey` is `${resource}:${startsAt ISO}` |

Access: `read` for admin and sales (`hasRole('admin', 'sales')`). `update` for admin only. The slot route reads this global from server code with the Local API. There is no public REST contract.

Hook: `afterChange: [revalidateBookingSettings]` from the skill. That hook regenerates `localizedPaths('/book')` only.

## bookings

Slug `bookings`. Group `Leads & Bookings`. No versions. No drafts.

| Field | Type | Notes |
| --- | --- | --- |
| service | relationship `services`, required | `index: true` |
| resource | text, required | Copied from settings at hold time |
| startsAt | date, required | UTC instant. `index: true` |
| endsAt | date, required | `startsAt` plus `durationMinutes` |
| slotKey | text, required, unique, index | `${resource}:${startsAt.toISOString()}`. Tombstone is `expired:${id}` |
| status | select, required | `pending_payment`, `confirmed`, `cancelled`, `expired`, `needs_refund`, `refunded`. Default `pending_payment`. `index: true` |
| holdExpiresAt | date, required | `index: true` |
| customerName | text, required | |
| email | email, required | |
| phone | text, required | E.164, validated with `z.e164()` in the route |
| locale | text, required | One of `locales` from `src/i18n/locales.ts` |
| amountMinor | number, required, min 0 | Copied from the service. Never from the browser |
| currency | select, required | Copied from the service |
| provider | select, required | The provider union |
| providerRef | text | Gateway order or session id. `index: true` |
| publicToken | text, required, unique, index | `randomBytes(32).toString('base64url')` from `node:crypto` |
| calendarEventId | text | |
| meetUrl | text | |
| notes | textarea | Sales may edit this |

Access:

```ts
access: {
  create: () => false,
  read: hasRole('admin', 'sales'),
  update: hasRole('admin', 'sales'),
  delete: hasRole('admin'),
},
```

Field `update` access is `hasRoleField('admin')` on `status`, `amountMinor`, `currency`, `provider`, `providerRef`, `publicToken`, `slotKey`, `holdExpiresAt`, `startsAt`, `endsAt`, `calendarEventId`, and `meetUrl`. Sales can change `notes` in the admin and cannot mark a booking paid. Cancellation is an admin action in this skill: set `status` to `cancelled` and move `slotKey` to `expired:${id}` in the same update so the unique key is free. Do not refund inside that update.

Do not add an `afterChange` revalidation hook. This collection regenerates no routes.

Server writes use `getPayloadClient()` and the default `overrideAccess: true`. Pass `depth: 0` on the hold and webhook writes.

## payment-events

Slug `payment-events`. Group `Leads & Bookings`. `admin.hidden` unless `user.role === 'admin'`.

| Field | Type | Notes |
| --- | --- | --- |
| provider | select, required | Provider union |
| providerEventId | text, required, unique, index | Idempotency key. See each provider reference |
| booking | relationship `bookings` | |
| outcome | select, required | `received`, `confirmed`, `needs_refund`, `ignored`, `amount_mismatch` |
| amountMinor | number | From the verified event, after conversion to minor units |
| currency | text | ISO code as sent, stored uppercase |

Access: `create`, `update`, and `delete` return false. `read` is `hasRole('admin')`. The webhook writes with the Local API.

Do not store the raw body, signature, PAN, token, or secret. Do not add a revalidation hook. This collection regenerates no routes.

## Money

`src/features/booking/money.ts` is imported by server code and by the booking form's display. It has no secrets and no Payload import.

```ts
export const CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD'] as const
export type Currency = (typeof CURRENCIES)[number]

export function currencyExponent(currency: Currency): number {
  switch (currency) {
    case 'EGP':
    case 'USD':
    case 'EUR':
    case 'SAR':
    case 'AED':
    case 'QAR':
      return 2
    case 'KWD':
    case 'BHD':
    case 'OMR':
    case 'JOD':
      return 3
    default: {
      const unhandled: never = currency
      throw new Error(`Unhandled currency: ${String(unhandled)}`)
    }
  }
}

function isDigits(value: string): boolean {
  if (value.length === 0) return false
  for (const char of value) {
    if (char < '0' || char > '9') return false
  }
  return true
}

export function toMinor(major: string, currency: Currency): number {
  const exponent = currencyExponent(currency)
  const negative = major.startsWith('-')
  const unsigned = negative ? major.slice(1) : major
  const [wholeRaw, fracRaw = ''] = unsigned.split('.')
  if (!isDigits(wholeRaw) || (fracRaw !== '' && !isDigits(fracRaw))) {
    throw new Error('Invalid amount')
  }
  if (fracRaw.length > exponent) throw new Error('Too many decimal places')
  const frac = fracRaw.padEnd(exponent, '0')
  const minor = Number(wholeRaw) * 10 ** exponent + Number(frac || '0')
  if (!Number.isSafeInteger(minor)) throw new Error('Amount out of range')
  return negative ? -minor : minor
}

export function toMajor(minor: number, currency: Currency): string {
  if (!Number.isSafeInteger(minor)) throw new Error('Amount out of range')
  const exponent = currencyExponent(currency)
  const negative = minor < 0
  const abs = Math.abs(minor)
  const factor = 10 ** exponent
  const whole = Math.trunc(abs / factor)
  const frac = String(abs % factor).padStart(exponent, '0')
  const value = exponent === 0 ? String(whole) : `${whole}.${frac}`
  return negative ? `-${value}` : value
}
```

`isDigits` rejects signs, spaces, and extra dots. Email, URL, and phone stay on `z.email()`, `z.url()`, and `z.e164()`.

`toMinor('10.5', 'EGP')` is `1050`. `toMinor('1.5', 'KWD')` is `1500`. `toMajor(1500, 'KWD')` is `1.500`.

## How each gateway wants the amount

| Gateway | Create-checkout amount | Webhook amount to compare |
| --- | --- | --- |
| Paymob | Integer minor units (`10000` for 100.00 EGP) | `obj.amount_cents` is already minor units |
| Kashier | JSON string from `toMajor` (`"100.00"`). Hash uses the numeric coercion (`100` for a whole amount) | Webhook `data.amount` converted with `toMinor` |
| Fawry | Two-decimal string inside the SHA-256 input (`10.00`). EGP only unless the client confirms another currency | `paymentAmount` formatted to two decimals, then `toMinor` |
| Stripe | `unit_amount` integer minor units, currency lowercase | `amount_total` integer minor units |
| PayPal | `amount.value` from `toMajor` | Capture `amount.value` via `toMinor` |
| Tap | Major-unit decimal in the charge JSON, written from `toMajor` so it is not a binary float | Hash uses `toMajor`. Compare the charge amount with `toMinor` |

Stripe, checked against the Supported currencies page on 2026-11-20: amounts are minor units, and currencies are two-decimal unless listed as zero-decimal. That page does not state that BHD, JOD, KWD, or OMR must be a multiple of 10. Send `amountMinor` with exponent 3. If the API rejects the amount and the error says it must be divisible by 10, stop and ask before rounding the client down. An older Stripe rule required that rounding; do not apply it silently.

## Compare-and-set

`payload.update` with `where` returns `{ docs, errors }` (Payload 3 Local API, update many). Success is `docs.length === 1` and an empty `errors` array.

```ts
const updated = await payload.update({
  collection: 'bookings',
  where: {
    and: [
      { id: { equals: booking.id } },
      { status: { equals: 'pending_payment' } },
    ],
  },
  data: { status: 'confirmed', providerRef: event.providerRef },
  depth: 0,
})
```

A unique-index failure throws. Catch it, then `find` the conflicting row. Do not wrap these calls in `payload.db.beginTransaction`. If libSQL returns a transaction error, retry that single call with `disableTransaction: true` and record it in `PROJECT.md`.

## Invalidation map rows

Add to `PROJECT.md`. Writes assume the locale count from `src/i18n/locales.ts`.

| Collection or global | Trigger | Paths (per locale) | Tags | Writes per save |
| --- | --- | --- | --- | --- |
| bookings | any | none | none | 0 |
| payment-events | any | none | none | 0 |
| booking-settings | update | /<locale>/book | none | 1 x locales |

`booking-settings` does not revalidate service pages. Those pages render `priceMinor` from the service document.
