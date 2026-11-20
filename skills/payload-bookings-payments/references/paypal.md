# PayPal

Use `fetch` against the Orders v2 and Webhooks v1 REST APIs. Do not install a second client, and do not use `@paypal/paypal-server-sdk` for this flow even though `versions.json` pins it.

The SDK exposes Orders and Payments controllers. PayPal's webhook check is `POST /v1/notifications/verify-webhook-signature`, and `webhook_event` must be the original JSON text. Parsing and stringifying it again changes key order and whitespace, and verification returns `FAILURE`. One `fetch` client keeps that raw body intact. The SDK does not remove the need for that call.

Sources: [Verify webhook signature](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post) and [Orders v2](https://developer.paypal.com/docs/api/orders/v2/).

## Credentials

| Name | Use |
| --- | --- |
| Client id and secret | OAuth client-credentials on the matching host |
| Webhook id | From the app's webhook subscription. It is not inside the event |
| Mode | Sandbox `https://api-m.sandbox.paypal.com`. Live `https://api-m.paypal.com` |

Create a sandbox business app and a sandbox personal buyer in the PayPal developer dashboard. Subscribe the webhook to `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`.

## Access token

`POST {base}/v1/oauth2/token`

`Authorization: Basic` plus base64 of `clientId:secret`. `Content-Type: application/x-www-form-urlencoded`. Body `grant_type=client_credentials`.

Cache the token in memory until `expires_in` minus 60 seconds. Do not log it. Do not put it in the booking.

## Create checkout

`POST {base}/v2/checkout/orders`

Header `PayPal-Request-Id: {publicToken}` so a retry returns the same order. Header `Content-Type: application/json`. Header `Authorization: Bearer {token}`.

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "custom_id": "<publicToken>",
      "invoice_id": "<publicToken>",
      "amount": { "currency_code": "USD", "value": "150.00" }
    }
  ],
  "payment_source": {
    "paypal": {
      "experience_context": {
        "return_url": "https://host/en/book/return?token=<publicToken>",
        "cancel_url": "https://host/en/book",
        "user_action": "PAY_NOW",
        "shipping_preference": "NO_SHIPPING"
      }
    }
  }
}
```

`amount.value` is `toMajor(amountMinor, currency)`. `currency_code` is uppercase. `custom_id` must be 127 characters or fewer; a 32-byte base64url token fits.

Redirect to the `links` entry whose `rel` is `payer-action`. If that rel is absent, use `approve`. Record which rel the sandbox returned in `PROJECT.md` if it is neither, and stop. `providerRef` is the order `id`.

The approval link can stay valid after our hold. A capture that arrives late uses the late-payment path. Read the sandbox order's expiration instead of assuming a duration.

## Return URL

The browser comes back with PayPal query parameters. Do not capture and do not confirm in that route. The return page polls our status route.

## Capture

On a verified `CHECKOUT.ORDER.APPROVED` whose order `custom_id` or `invoice_id` matches `publicToken`, and whose booking is still an open hold or a late-payment candidate:

`POST {base}/v2/checkout/orders/{orderId}/capture`

Header `PayPal-Request-Id: {publicToken}-capture`. JSON body `{}`.

Confirm from that capture when its `status` is `COMPLETED` and the amount matches. If the order was already captured, `GET {base}/v2/checkout/orders/{orderId}` and read the capture on the purchase unit. Do not guess an error name.

A verified `PAYMENT.CAPTURE.COMPLETED` is the same confirmation. The compare-and-set makes the pair confirm once. `providerEventId` is the webhook event `id` for webhook deliveries, and `capture:{captureId}` when the capture response itself confirms before a webhook exists. Insert the payment event before the booking update, using the capture id, so the webhook delivery finds the duplicate and stops.

`PAYMENT.CAPTURE.DENIED` does not confirm. `PAYMENT.CAPTURE.REFUNDED` does not send a confirmation email.

Amount check: `toMinor(capture.amount.value, currency)` against `amountMinor`, and `currency_code` against `booking.currency`.

## Verify the webhook

Read `rawBody` with `request.text()`. Parse it only to prove it is one JSON value. Send the original string as `webhook_event`.

Headers (Fetch lowercases them): `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time`.

```ts
const body =
  `{"auth_algo":${JSON.stringify(algo)}` +
  `,"cert_url":${JSON.stringify(certUrl)}` +
  `,"transmission_id":${JSON.stringify(transmissionId)}` +
  `,"transmission_sig":${JSON.stringify(transmissionSig)}` +
  `,"transmission_time":${JSON.stringify(transmissionTime)}` +
  `,"webhook_id":${JSON.stringify(process.env.PAYPAL_WEBHOOK_ID)}` +
  `,"webhook_event":${rawBody}}`

const response = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body,
})
```

Accept only `verification_status === 'SUCCESS'`. Anything else returns null, and the route responds 401. PayPal retries non-2xx responses. A verified duplicate still returns 200.

There is no published numeric test vector for this call. The sandbox webhook simulator is the check.

## Refunds

Do not call `POST /v2/payments/captures/{capture_id}/refund` from the webhook. Read the Payments v2 refund page before an admin action. The capture id to refund is the one stored as `providerRef` after capture (store the capture id in `providerRef` once you have it, keeping the order id in the payment event).

## Common errors

| Symptom | Cause |
| --- | --- |
| `FAILURE` on an unmodified sandbox event | `webhook_event` was re-serialized, or `webhook_id` is from the other mode |
| `AMOUNT_MISMATCH` or similar on capture | `value` was integer cents (`15000`) instead of `"150.00"` |
| Two orders for one booking | Missing `PayPal-Request-Id` on a retry |
| Currency rejected | The PayPal account cannot present that currency. Stop and ask |
