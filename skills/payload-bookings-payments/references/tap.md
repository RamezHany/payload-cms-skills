# Tap

Sources checked: [Create a charge](https://developers.tap.company/reference/create-a-charge) and [Webhook hashstring](https://developers.tap.company/docs/webhook). Charges API v2. No Tap SDK.

## Credentials

The client supplies the secret API key. Test keys start with `sk_test_`. Live keys start with `sk_live_`. The same key is the webhook HMAC key. There is no separate webhook secret.

Do not use the sample `sk_test_` value printed in Tap's hashstring snippet. Create a key in the client's Tap dashboard.

Ask which currencies the merchant can charge. Tap is the Gulf path (SAR, AED, QAR, KWD, BHD, OMR). EGP is in Tap's hashstring decimal examples, but the account must still have it enabled.

## Create checkout

`POST https://api.tap.company/v2/charges`

`Authorization: Bearer <secret key>`. `Content-Type: application/json`.

| Field | Value |
| --- | --- |
| amount | Major units from `toMajor`, inserted as a JSON number without going through a binary float. `150.00` EGP is `150.00` in the JSON text. Tap's reference describes this as the currency unit (`100` charges 100, `100.5` charges 100.50) |
| currency | Uppercase ISO code |
| threeDSecure | `true` |
| customer_initiated | `true` |
| save_card | `false` |
| description | Service title |
| metadata.publicToken | `publicToken` |
| reference.transaction | `publicToken` |
| reference.order | String booking id |
| receipt.email and receipt.sms | `false` (our email is the confirmation) |
| customer | `first_name`, `email`, and `phone` split into the country code and number Tap's customer object requires. Read the create-charge schema for the phone shape before guessing keys |
| source.id | `src_card` for a card redirect. Use another source id only when the create-charge page lists it for this merchant |
| redirect.url | Booking return URL. Tap appends `tap_id`. Ignore it for confirmation |
| post.url | `https://<host>/api/webhooks/tap` |

Redirect to `transaction.url`. `providerRef` is the charge `id` (`chg_...`).

## Webhook

Tap POSTs the charge object. Header `hashstring` is the HMAC. A `hash` header is also present in Tap's sample and is not the check. Verify `hashstring`.

HMAC-SHA256, lowercase hex, keyed with the secret API key, over this exact sequence. Keep each label even when the value is empty:

```text
x_id + id
+ x_amount + amount formatted to the currency's decimals
+ x_currency + currency
+ x_gateway_reference + reference.gateway (empty string when missing)
+ x_payment_reference + reference.payment
+ x_status + status
+ x_created + transaction.created
```

Decimal places Tap lists on the webhook page: AED, QAR, SAR, USD, EUR, GBP, EGP use 2 (`2.00`). BHD, KWD, OMR, JOD use 3 (`3.000`). Format with `toMajor`. Hashing the raw JSON number (`x_amount3` instead of `x_amount3.000`) rejects every real webhook.

`transaction.created` is copied as Tap sent it. Do not reformat the timestamp.

```ts
function amountTokenFromRawBody(rawBody: string): string {
  const key = '"amount":'
  const start = rawBody.indexOf(key)
  if (start < 0) throw new Error('Missing amount')
  let index = start + key.length
  while (rawBody[index] === ' ') index += 1
  let end = index
  while (end < rawBody.length && '0123456789.'.includes(rawBody[end] ?? '')) end += 1
  const token = rawBody.slice(index, end)
  if (!token) throw new Error('Missing amount')
  return token
}

const amount = toMajor(toMinor(amountTokenFromRawBody(rawBody), currency), currency)
const toSign =
  `x_id${charge.id}` +
  `x_amount${amount}` +
  `x_currency${charge.currency}` +
  `x_gateway_reference${charge.reference?.gateway ?? ''}` +
  `x_payment_reference${charge.reference?.payment ?? ''}` +
  `x_status${charge.status}` +
  `x_created${charge.transaction?.created ?? ''}`
```

Take the `amount` number token from `rawBody` before `JSON.parse` turns it into a JavaScript number, then pad with `toMajor(toMinor(token))`. That accepts `3`, `3.0`, and `3.000` and writes `3.000` for a three-decimal currency. Do not hash `String(parsedNumber)`, which can turn `3.000` into `3` or add binary noise. Compare the hex digest to the `hashstring` header with `timingSafeEqualString`.

Tap's docs include a sample secret and a sample header value tied to a live-looking charge. Do not copy that secret into `.env`. Build the signed string from a sandbox charge you received, and compare against that delivery.

Confirm only when `status` is `CAPTURED`. Every other status returns 200 and does not confirm. `providerEventId` is `` `${id}:${status}` ``. Match `reference.transaction` to `publicToken`. Compare the amount with `toMinor`.

The return URL is not verification. Tap's own best-practices page says to confirm from the webhook or from a server-side retrieve. This skill confirms from the verified webhook only.

## Refunds

Do not refund in the webhook. Tap's best-practices page says refunds go through the API or the dashboard. Read the refund reference for the current path before an admin action. A refund notification must not send another confirmation email.

## Common errors

| Symptom | Cause |
| --- | --- |
| Every webhook fails hashstring | Amount not padded (`1` instead of `1.000` KWD), or `x_gateway_reference` label removed because the value was empty |
| Hash matches locally and fails live | Secret from the other mode, or `transaction.created` was converted to an ISO string |
| No redirect URL | `source.id` is not a redirect source for this account. Read the charge response `status` and errors |
| Currency rejected | The Tap merchant cannot charge that currency |
