# Paymob

Sources checked: [Create Intention](https://developers.paymob.com/paymob-docs/developers/intention-apis/create-intention), [Unified Checkout](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/unified-checkout-redirection), [HMAC transaction callback](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback), and the regional base URLs in the Pixel guide. Confirm the test card numbers on Paymob's test-credentials page. Do not copy card numbers from memory.

## Credentials the client supplies

| Name | Use |
| --- | --- |
| Secret key | `Authorization: Token <secret key>` on the intention call. The word `Token`, a space, then the key. Not `Bearer` |
| Public key | Query parameter on the checkout URL only. Still server-only in this project |
| HMAC secret | Webhook verification. Not the secret key |
| Integration ids | Integers or names in `payment_methods`. Test ids with a test secret, live ids with a live secret |
| API base and checkout base | From the region table |

| Region | Intention base | Checkout URL |
| --- | --- | --- |
| Egypt | `https://accept.paymob.com/` | `https://eg.checkout.paymob.com/?publicKey={publicKey}&clientSecret={clientSecret}` |
| UAE | `https://uae.paymob.com/` | `https://uae.checkout.paymob.com/?publicKey={publicKey}&clientSecret={clientSecret}` |
| Oman | `https://oman.paymob.com/` | `https://om.checkout.paymob.com/?publicKey={publicKey}&clientSecret={clientSecret}` |
| KSA | `https://ksa.paymob.com/` | `https://ksa.checkout.paymob.com/?publicKey={publicKey}&clientSecret={clientSecret}` |

Ask which region the merchant account uses. The intention path is `v1/intention/` on that base.

## Create checkout

`POST {apiBase}v1/intention/`

`amount` is integer minor units (cents). `currency` must match the integration. `payment_methods` is the integration id list. `special_reference` is `publicToken` (Paymob returns it as `merchant_order_id`). `notification_url` is the webhook. `redirection_url` is the booking return page.

Send one `items` entry with `name` and `amount` (both required when `items` is present). Send `billing_data.phone_number` (required when `billing_data` is present), plus email, first name, and last name. Address keys Paymob's examples include (`apartment`, `floor`, `street`, `building`, `city`, `country`, `state`, `postal_code`) can be `"NA"` when the client does not collect an address. `country` for Egypt in those examples is `EG`.

The `expiration` body field is documented as a number without a unit. Do not send it. The hold clock is ours. The client secret expires one hour after creation.

Response `201`: store `intention_order_id` as `providerRef` (it is `obj.order.id` on the callback). Redirect the browser to the regional checkout URL with `publicKey` and `client_secret`. URL-encode both.

## Return URL

Paymob also GETs a transaction response callback onto `redirection_url` and adds `hmac`. That request is the customer's browser. Do not confirm from it. The return page polls our status route.

## Webhook

Transaction processed callback: `POST` JSON, `hmac` in the query string. Read the raw body, then parse. The transaction is `body.obj`.

Confirm only when `success === true`, `pending === false`, and `is_refunded` is not true. `providerEventId` is `String(obj.id)`. `providerRef` match is `String(obj.order.id)` or `obj.order.merchant_order_id === publicToken`. `amount_cents` is minor units. `currency` is compared uppercase.

### HMAC-SHA512 field order

Use this order. Do not sort JSON keys. The documentation heading says lexicographic, then prints this fixed list, which is not alphabetical.

POST (processed) values, concatenated with no separator:

`amount_cents`, `created_at`, `currency`, `error_occured`, `has_parent_transaction`, `id`, `integration_id`, `is_3d_secure`, `is_auth`, `is_capture`, `is_refunded`, `is_standalone_payment`, `is_voided`, `order.id`, `owner`, `pending`, `source_data.pan`, `source_data.sub_type`, `source_data.type`, `success`

The key is `is_capture`, not `is_captured`. The key is `error_occured` (one r). Booleans become `true` or `false`. Numbers become their plain decimal form. A missing value becomes an empty string, not `null` or `undefined`.

```ts
import { createHmac } from 'node:crypto'

const concatenated = [
  obj.amount_cents,
  obj.created_at,
  obj.currency,
  obj.error_occured,
  obj.has_parent_transaction,
  obj.id,
  obj.integration_id,
  obj.is_3d_secure,
  obj.is_auth,
  obj.is_capture,
  obj.is_refunded,
  obj.is_standalone_payment,
  obj.is_voided,
  obj.order?.id,
  obj.owner,
  obj.pending,
  obj.source_data?.pan,
  obj.source_data?.sub_type,
  obj.source_data?.type,
  obj.success,
].map((value) => (value === undefined || value === null ? '' : String(value))).join('')

const digest = createHmac('sha512', hmacSecret).update(concatenated).digest('hex')
```

Compare `digest` to the `hmac` query parameter with `timingSafeEqualString` after lowercasing both.

The GET response callback uses `id` instead of `obj.id` and `order_id` instead of `order.id`. This route is the POST callback. Do not use the GET names here.

### Worked vector

Paymob's published processed-callback sample concatenates to:

```text
1000002024-06-13T11:33:44.592345EGPfalsefalse1920364654097558truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue
```

That string is `amount_cents=100000`, `created_at=2024-06-13T11:33:44.592345`, `currency=EGP`, then the booleans and ids in the order above, ending in `success=true`. The page also prints a sample HMAC hex. It does not print the HMAC secret that produced it, so do not try to reproduce that digest. Assert the concatenation against this string in a unit check, and assert the digest against a sandbox callback whose secret you hold.

## Refunds

A later callback with `is_refunded: true` is not a new payment. Record it and move a `confirmed` booking to `refunded` only when an admin has already decided to refund. Do not call Paymob's refund or void API from the webhook. Read the current Managing Payments page before an admin refund tool is added.

## Common errors

| HTTP or symptom | Cause |
| --- | --- |
| 404 integration id does not exist | Id is from the other mode, or it is not an online integration |
| 400 `items.name` or `items.amount` | `items` was sent without those keys |
| 400 `billing_data.phone_number` | `billing_data` was sent without a phone |
| HMAC never matches | Used `is_captured`, sorted keys, or stringified booleans with quotes |
| Paid in the dashboard, booking still pending | Only the browser redirect was handled |
