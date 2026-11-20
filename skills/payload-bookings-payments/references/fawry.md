# Fawry

Online card payment uses the charge API with 3DS. The server never sees a card number, expiry, or CVV. Pay at Fawry (a reference the customer pays at a kiosk) is a different product: the payment arrives hours later. Do not enable it unless the client accepts a hold that long.

## What was checked

Server notification V2 is documented at [Server notification V2](https://developer.fawrystaging.com/docs/express-checkout/payment-notifications/server-notification-v2). `messageSignature` is the SHA-256 hex digest, not an HMAC, of this concatenation with no separators:

```text
fawryRefNumber + merchantRefNumber + paymentAmount (two decimals) + orderAmount (two decimals) + orderStatus + paymentMethod + paymentRefrenceNumber + secureKey
```

The official field name is `paymentRefrenceNumber` (no second e). When that value is absent, keep an empty segment. Do not drop it and do not write a placeholder word.

Format both amounts with exactly two digits (`10.00`) from the numbers in the JSON. `String(10)` produces `10` and will never match. Use `toMajor` after `toMinor` of the received value, and only for EGP (exponent 2). Stop if the account currency is not EGP.

The charge-request signature uses the same construction (plain SHA-256, values concatenated, secure key last, no separator). Fawry's published charge description is:

```text
merchantCode + merchantRefNum + customerProfileId (empty when omitted) + paymentMethod + amount (two decimals, such as 10.00) + secureKey
```

The charge page on `developer.fawrystaging.com` did not load while this reference was written. Before the first sandbox call, open that charge section and confirm this order. Some community SDKs join the values with commas. Those digests are rejected. There is no `Authorization` header. The signature is the authentication.

## Credentials and endpoints

The client supplies `merchantCode` and the secure key, one pair for staging and one for production.

| Mode | Charge URL |
| --- | --- |
| Sandbox | `POST https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/charge` |
| Production | `POST https://www.atfawry.com/ECommerceWeb/Fawry/payments/charge` |

Status, if you need it after a dispute, is `GET {base}/ECommerceWeb/Fawry/payments/status/v2` with `merchantCode`, `merchantRefNumber`, and a signature over `merchantCode + merchantRefNumber + secureKey`. Do not confirm a booking from a status poll on the return page. The webhook is the confirmation.

## Create checkout

JSON body:

| Field | Value |
| --- | --- |
| merchantCode | From the client |
| merchantRefNum | `publicToken` |
| customerProfileId | `publicToken`, and the same value inside the signature |
| customerName, customerMobile, customerEmail | From the booking. Mobile is the national number Fawry expects; keep `phone` in E.164 in Payload and ask the client for the Fawry mobile format if staging rejects it |
| paymentMethod | `CARD` |
| amount | Number matching the two-decimal string, for example `150.00` written into the JSON from `toMajor` so it is not a binary float |
| currencyCode | `EGP` |
| enable3DS | `true` |
| returnUrl | Booking return URL |
| chargeItems | One item: `itemId` `consultation`, `description` the service title, `price` the same amount, `quantity` `1` |
| signature | SHA-256 hex of the concatenation above |
| language | `en-gb` or the code the charge page lists for Arabic. Do not put Arabic script in source files |

`paymentMethod` in the signature is the exact string in the body. `CARD` and `PayAtFawry` are different.

Store `referenceNumber` or `fawryRefNumber` from the response as `providerRef`. Redirect the browser to the response redirect URL (published 3DS examples call it `redirectUrl`). If the sandbox uses another key, use that key and record it in `PROJECT.md`.

## Webhook

Fawry POSTs the V2 notification to the URL registered on the merchant account. The merchant must register `https://<host>/api/webhooks/fawry` for staging and for production. The body field `messageSignature` is the digest.

`providerEventId` is `requestId` when it is present, otherwise `` `${fawryRefNumber}:${orderStatus}` ``. Confirm only when `orderStatus` is `PAID`. `NEW`, `CANCELED`, `EXPIRED`, `FAILED`, `REFUNDED`, and `PARTIAL_REFUNDED` do not confirm. A `REFUNDED` notification moves a confirmed booking to `refunded` only after an admin refund, and it must not send another confirmation email.

Find the booking by `merchantRefNumber === publicToken`. Compare `paymentAmount` (two-decimal form, then `toMinor`) to `amountMinor`.

Compare the digest with `timingSafeEqualString` after lowercasing both hex strings.

## Refunds

Do not refund from the webhook. Fawry's refund request has its own signature order. Read that section of the developer portal before an admin refund action exists.

## Common errors

| Symptom | Cause |
| --- | --- |
| Wrong signature / 9965 | Amount not forced to two decimals, `customerProfileId` omitted in only one of the body and the hash, or commas inserted |
| Notification hash mismatch | `paymentRefrenceNumber` dropped when empty, or `paymentAmount` stringified without two decimals |
| Customer paid, booking pending | The kiosk product was used, or the server notification URL was not registered |
| Card data requested | The direct card charge was implemented. Stop. Use `enable3DS` and a redirect |
