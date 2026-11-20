# Paymob Payment Gateway Integration (Intention API, Unified Checkout & HMAC-SHA512 Security)

Use this reference whenever the user confirms in Phase 0 that the project requires a payment gateway (Default: **Paymob** for Egypt, UAE, KSA, Oman, Pakistan). Based on the official Paymob Developer Portal (`https://developers.paymob.com`) and the official Paymob AI Agent Skill (`PaymobAccept/Paymob-AI-Integration-Skill`).

## 1. Environment Variables (`.env.example`)

Never hardcode Paymob keys in client-side code. Only `NEXT_PUBLIC_PAYMOB_PUBLIC_KEY` may be exposed if using Embedded Pixel; for Unified Checkout redirection, keep all keys server-side.

```env
# Paymob Regional Base URL:
# Egypt: https://accept.paymob.com
# UAE:   https://uae.paymob.com
# KSA:   https://ksa.paymob.com
# Oman:  https://oman.paymob.com
PAYMOB_BASE_URL=https://accept.paymob.com

# Keys from Paymob Dashboard -> Settings -> Account Info
PAYMOB_SECRET_KEY=egy_sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
PAYMOB_PUBLIC_KEY=egy_pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
PAYMOB_HMAC_SECRET=your_hmac_secret_from_dashboard

# Comma-separated Integration IDs (e.g. Card, Mobile Wallet, ValU, Apple Pay)
PAYMOB_INTEGRATION_IDS=123456,123457
PAYMOB_CURRENCY=EGP
```

## 2. Payments / Orders Collection (`src/collections/Orders.ts`)

Store every payment intention and transaction status inside Payload CMS with a styled admin table and CSV export:

```ts
import type { CollectionConfig } from 'payload'
import { withHiddenAPI } from '@/lib/withHiddenAPI'
import { isAdminOrSuperAdmin } from './Users'

export const Orders: CollectionConfig = withHiddenAPI({
  slug: 'orders',
  labels: {
    singular: 'Order / Payment',
    plural: 'Orders & Payments',
  },
  admin: {
    useAsTitle: 'merchantOrderId',
    defaultColumns: [
      'merchantOrderId',
      'customerEmail',
      'amountCents',
      'currency',
      'status',
      'paymobTransactionId',
      'createdAt',
    ],
    group: 'Payments & Commerce',
  },
  access: {
    create: isAdminOrSuperAdmin,
    read: isAdminOrSuperAdmin,
    update: isAdminOrSuperAdmin,
    delete: isAdminOrSuperAdmin,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'merchantOrderId', type: 'text', required: true, unique: true, index: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Paid', value: 'paid' },
            { label: 'Failed', value: 'failed' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Voided', value: 'voided' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'amountCents', type: 'number', required: true, label: 'Amount (in Cents/Piastres)' },
        { name: 'currency', type: 'text', required: true, defaultValue: 'EGP' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'customerName', type: 'text', required: true },
        { name: 'customerEmail', type: 'email', required: true },
        { name: 'customerPhone', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'paymobIntentionId', type: 'text', admin: { readOnly: true } },
        { name: 'paymobOrderId', type: 'text', index: true, admin: { readOnly: true } },
        { name: 'paymobTransactionId', type: 'text', index: true, admin: { readOnly: true } },
      ],
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'amountCents', type: 'number', required: true },
        { name: 'quantity', type: 'number', required: true, defaultValue: 1 },
      ],
    },
  ],
  timestamps: true,
})
```

## 3. Creating a Payment Intention (`POST /v1/intention/`)

Always use Paymob's modern **Intention API** (`/v1/intention/`) rather than the legacy 3-step auth/order/payment_keys flow. Note that Paymob requires all billing fields to be non-empty (use `'NA'` for optional address fields if not collected):

```ts
// src/lib/paymob.ts
import crypto from 'crypto'

export interface CreatePaymobIntentionInput {
  merchantOrderId: string
  amountCents: number // e.g., 25000 for 250.00 EGP
  currency?: string
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  items?: Array<{
    name: string
    amount: number // in cents
    description?: string
    quantity: number
  }>
}

export async function createPaymobIntention(input: CreatePaymobIntentionInput) {
  const baseUrl = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com'
  const secretKey = process.env.PAYMOB_SECRET_KEY
  const publicKey = process.env.PAYMOB_PUBLIC_KEY
  const currency = input.currency || process.env.PAYMOB_CURRENCY || 'EGP'
  const integrationIds = (process.env.PAYMOB_INTEGRATION_IDS || '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter(Boolean)

  if (!secretKey || !publicKey || integrationIds.length === 0) {
    throw new Error('Missing PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, or PAYMOB_INTEGRATION_IDS')
  }

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  const response = await fetch(`${baseUrl}/v1/intention/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountCents,
      currency,
      payment_methods: integrationIds,
      special_reference: input.merchantOrderId,
      notification_url: `${serverUrl}/api/paymob/webhook`,
      redirection_url: `${serverUrl}/payment/result`,
      items:
        input.items || [
          {
            name: `Order ${input.merchantOrderId}`,
            amount: input.amountCents,
            description: `Payment for ${input.merchantOrderId}`,
            quantity: 1,
          },
        ],
      billing_data: {
        apartment: 'NA',
        first_name: input.customer.firstName || 'Customer',
        last_name: input.customer.lastName || 'User',
        street: 'NA',
        building: 'NA',
        phone_number: input.customer.phone,
        city: 'NA',
        country: 'EG',
        email: input.customer.email,
        floor: 'NA',
        state: 'NA',
        postal_code: 'NA',
        shipping_method: 'NA',
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Paymob Intention failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const checkoutUrl = `${baseUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(
    publicKey,
  )}&clientSecret=${encodeURIComponent(data.client_secret)}`

  return {
    intentionId: data.id,
    paymobOrderId: data.intention_order_id ? String(data.intention_order_id) : undefined,
    clientSecret: data.client_secret,
    checkoutUrl,
  }
}
```

## 4. Exact 20-Field Lexicographical HMAC-SHA512 Verification

**CRITICAL SECURITY RULE**:
1. Never update order status from the browser GET redirect (`redirection_url`) alone without verifying the HMAC. Always rely on the server-to-server **Transaction Processed Callback (`POST`)** and verify the HMAC-SHA512 signature using `crypto.timingSafeEqual`.
2. Paymob does NOT sign the raw JSON body. It concatenates **20 specific fields in exact lexicographical order** (with no separators, converting booleans to lowercase `'true'` or `'false'`, and `null`/`undefined` to `''`), hashes that string with **HMAC-SHA512** using `PAYMOB_HMAC_SECRET`, and compares it against `?hmac=` in the query string.

The 20 fields in exact order:
1. `amount_cents`
2. `created_at`
3. `currency`
4. `error_occured` (note Paymob's single-'r' spelling: `error_occured`)
5. `has_parent_transaction`
6. `id` (`obj.id` in POST body)
7. `integration_id`
8. `is_3d_secure`
9. `is_auth`
10. `is_capture`
11. `is_refunded`
12. `is_standalone_payment`
13. `is_voided`
14. `order.id` (`obj.order.id` in POST body, or `order` in GET query)
15. `owner`
16. `pending`
17. `source_data.pan` (`obj.source_data.pan` in POST, or `source_data_pan` in GET)
18. `source_data.sub_type` (`obj.source_data.sub_type` in POST, or `source_data_sub_type` in GET)
19. `source_data.type` (`obj.source_data.type` in POST, or `source_data_type` in GET)
20. `success`

```ts
// Verify POST Webhook (Transaction Processed Callback)
export function verifyPaymobPostWebhookHmac(
  obj: Record<string, any>,
  receivedHmac: string | null,
): boolean {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET
  if (!hmacSecret || !receivedHmac || !obj) return false

  const val = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  const concatenated = [
    val(obj.amount_cents),
    val(obj.created_at),
    val(obj.currency),
    val(obj.error_occured),
    val(obj.has_parent_transaction),
    val(obj.id),
    val(obj.integration_id),
    val(obj.is_3d_secure),
    val(obj.is_auth),
    val(obj.is_capture),
    val(obj.is_refunded),
    val(obj.is_standalone_payment),
    val(obj.is_voided),
    val(obj.order?.id ?? obj.order),
    val(obj.owner),
    val(obj.pending),
    val(obj.source_data?.pan),
    val(obj.source_data?.sub_type),
    val(obj.source_data?.type),
    val(obj.success),
  ].join('')

  const calculatedHmac = crypto
    .createHmac('sha512', hmacSecret)
    .update(concatenated)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac, 'hex'),
      Buffer.from(receivedHmac, 'hex'),
    )
  } catch {
    return false
  }
}

// Verify GET Redirect Query Params (Transaction Response Callback)
export function verifyPaymobRedirectQueryHmac(searchParams: URLSearchParams): boolean {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET
  const receivedHmac = searchParams.get('hmac')
  if (!hmacSecret || !receivedHmac) return false

  const getParam = (key: string) => searchParams.get(key) ?? ''

  const concatenated = [
    getParam('amount_cents'),
    getParam('created_at'),
    getParam('currency'),
    getParam('error_occured'),
    getParam('has_parent_transaction'),
    getParam('id'),
    getParam('integration_id'),
    getParam('is_3d_secure'),
    getParam('is_auth'),
    getParam('is_capture'),
    getParam('is_refunded'),
    getParam('is_standalone_payment'),
    getParam('is_voided'),
    getParam('order'),
    getParam('owner'),
    getParam('pending'),
    getParam('source_data.pan'),
    getParam('source_data.sub_type'),
    getParam('source_data.type'),
    getParam('success'),
  ].join('')

  const calculatedHmac = crypto
    .createHmac('sha512', hmacSecret)
    .update(concatenated)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac, 'hex'),
      Buffer.from(receivedHmac, 'hex'),
    )
  } catch {
    return false
  }
}
```

## 5. Next.js Webhook Route Handler (`src/app/api/paymob/webhook/route.ts`)

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { verifyPaymobPostWebhookHmac } from '@/lib/paymob'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const hmac = url.searchParams.get('hmac')
  const body = await request.json().catch(() => null)
  const obj = body?.obj

  if (!obj || !verifyPaymobPostWebhookHmac(obj, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })
  const merchantOrderId = obj.order?.merchant_order_id || obj.special_reference
  const paymobOrderId = String(obj.order?.id || '')

  // Determine exact transaction state from Paymob boolean flags
  let newStatus: 'paid' | 'failed' | 'refunded' | 'voided' | 'pending' = 'pending'
  if (obj.is_refunded === true) {
    newStatus = 'refunded'
  } else if (obj.is_voided === true) {
    newStatus = 'voided'
  } else if (obj.success === true && obj.error_occured === false && obj.pending === false) {
    newStatus = 'paid'
  } else if (obj.pending === false && (obj.success === false || obj.error_occured === true)) {
    newStatus = 'failed'
  }

  const existing = await payload.find({
    collection: 'orders',
    where: merchantOrderId
      ? { merchantOrderId: { equals: String(merchantOrderId) } }
      : { paymobOrderId: { equals: paymobOrderId } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'orders',
      id: existing.docs[0].id,
      data: {
        status: newStatus,
        paymobTransactionId: String(obj.id),
        paymobOrderId,
      },
    })
  }

  return NextResponse.json({ received: true, status: newStatus })
}
```
