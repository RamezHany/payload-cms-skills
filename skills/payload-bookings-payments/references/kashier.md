# Kashier

Sources checked: [Payment sessions](https://developers.kashier.io/docs/accept-payments/payment-sessions), [Request hashing](https://developers.kashier.io/docs/direct-api/hashing), [Webhooks](https://developers.kashier.io/docs/webhooks). Use the hosted session. Do not build the legacy query-string checkout, and do not embed the iframe for the first version (the browser `postMessage` success event is forgeable).

## Credentials the client supplies

| Name | Use |
| --- | --- |
| Merchant id | `merchantId`, and the `{mid}` segment of the order hash |
| Secret key | `Authorization` header value, as the raw secret. The published curl has no `Bearer` prefix |
| Payment API key | `api-key` header, and the HMAC key for the order hash and `x-kashier-signature`. Not the secret key |
| Mode | `test` uses `test-api.kashier.io`. `live` uses `api.kashier.io`. A test API key fails on the live host |

The checkout host is `https://payments.kashier.io` in both modes. The `sessionUrl` carries `mode`.

## Create checkout

`POST https://test-api.kashier.io/v3/payment/sessions` (live: `https://api.kashier.io/v3/payment/sessions`).

Headers: `Authorization: <secret key>`, `api-key: <payment API key>`, `Content-Type: application/json`.

Body fields to send:

| Field | Value |
| --- | --- |
| merchantId | Merchant id |
| order | `publicToken`. Kashier rejects a duplicate order for the same merchant |
| amount | `toMajor(amountMinor, currency)`, for example `"100.00"` |
| currency | `EGP` or the currency the account can charge |
| expireAt | `holdExpiresAt` as an ISO timestamp |
| merchantRedirect | Booking return URL |
| serverWebhook | `https://<host>/api/webhooks/kashier` |
| type | `one-time` |
| allowedMethods | `card,wallet` |
| display | `en` or `ar` from `booking.locale`. Those are locale codes, not translated labels |
| enable3DS | `true` |
| interactionSource | `ECOMMERCE` |
| customer.email | Booking email |
| paymentType | `credit` |

Do not send `saveCard`, `retrieveSavedCard`, or a card token. The hash below then has no customer-reference segment.

Redirect the browser to `sessionUrl`. Store the session id as `providerRef`.

### Order hash

HMAC-SHA256, lowercase hex, keyed with the Payment API key. For a payment session with no card save, the signed string is:

```text
/?payment={merchantId}.{order}.{amount}.{currency}
```

Kashier's session-create note says the amount is coerced to a number before signing, so `20.00` is signed as `20` and `20.50` stays `20.5`. Build that amount with `Number(toMajor(...))` and `String(...)`, and use the same merchant id and order you put in the JSON.

Published vector: path `/?payment=mid-0-1.99.20.EGP` with key `11111` digests to `606a8a1307d64caf4e2e9bb724738f115a8972c27eccb2a8acd9194c357e4bec`.

The create-session curl on the payment-sessions page does not name the header or body field that carries this hash. Read the Create payment session reference before the first call and put the hash where that reference puts it. If the reference still omits it, call the endpoint as published. On an invalid-hash error, stop and ask rather than inventing a header name.

## Return URL

Kashier appends a fixed query list to `merchantRedirect`: `paymentStatus`, `cardDataToken`, `maskedCard`, `merchantOrderId`, `orderId`, `cardBrand`, `orderReference`, `transactionId`, `amount`, `currency`, then `signature`. `mode` is not signed. A missing parameter is the literal string `null`.

HMAC-SHA256 (Payment API key) over that list joined as `key=value` with `&`. This signature proves the redirect was not edited. It still does not confirm the booking. The return page ignores it and polls our status route.

## Webhook

`POST` JSON `{ event, data }`. Header `x-kashier-signature`. Respond 200 before slow work. Kashier also treats 409 as acknowledged and retries other statuses for up to 10 attempts. Use 200 for a verified event, including duplicates. Use 401 for a bad signature.

`event` is the operation (`pay`, `refund`, and others). It is not a success flag. Confirm only when `event === 'pay'` and `data.status === 'SUCCESS'`. A `refund` event does not confirm. `event: "idempotency"` and status code `ORDER_PAID_BEFORE` must not create another booking.

`providerEventId` is `` `${data.transactionId}:${data.status}` ``. Kashier de-duplicates on transaction id, webhook URL, and status, and the same transaction id can be delivered again.

### Signature

1. Copy `data.signatureKeys` and sort it with the default string sort.
2. For each key, take `data[key]` as Kashier sent it. A JSON number `1` becomes `1`, not `1.00`.
3. Encode each value with `encodeURIComponent`. Encode values only. Spaces become `%20`, `|` becomes `%7C`. Do not use a serializer that encodes spaces as `+`.
4. Join `key=encodedValue` with `&`.
5. HMAC-SHA256 with the Payment API key, lowercase hex.
6. Compare to `x-kashier-signature` with `timingSafeEqualString` after lowercasing both.

Published vector, key `11111`, digest `9610477b2255b2a8ef84fd89adfaa5f1305ff9c20324205851890f1ea03109f4`:

```text
amount=1&channel=online%20%7C%20e-commerce&currency=EGP&kashierOrderId=9ad06b17-755b-4e21-9774-aff3e2726ac9&merchantOrderId=1653481557813&method=card&orderReference=TEST-ORD-38855&status=SUCCESS&transactionId=TX-249893963&transactionResponseCode=00
```

`data.hash` is not the merchant signature. Ignore it.

Match the booking by `merchantOrderId` or `orderReference` equal to `publicToken`. Convert `data.amount` with `toMinor`.

## Refunds

Do not refund from the webhook. Kashier documents refunds as a separate merchant API authenticated with the secret key, not with the payment hash. Read that page before adding an admin refund action.

## Common errors

| Symptom | Cause |
| --- | --- |
| Invalid hash, formula looks right | Test key against the live host, or `20.00` signed where Kashier coerces to `20` |
| `ERR_ORD_02` | `order` reused. Use a new `publicToken` per hold |
| Webhook hash mismatch | Keys not sorted, space encoded as `+`, or the secret key used instead of the Payment API key |
| Sandbox missing a method | Outside live mode Kashier forces card and wallet. That does not mean the live account lacks other methods |
