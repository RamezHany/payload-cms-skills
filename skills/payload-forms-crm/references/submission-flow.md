# Submission flow

Extends the lead form in the `project-architecture` skill. Packages already in the project: `zod`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `next-intl`. Add `libphonenumber-js`.

## Schema

`src/features/leads/schema.ts`

```ts
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { z } from 'zod'

import { locales } from '@/i18n/locales'

// ISO 3166-1 alpha-2 from PROJECT.md. International numbers parse without it.
const DEFAULT_PHONE_COUNTRY = 'SA' satisfies CountryCode

export const leadErrorCodes = [
  'invalid_input',
  'invalid_phone',
  'rejected',
  'verification_failed',
  'rate_limited',
  'unavailable',
] as const

export type LeadErrorCode = (typeof leadErrorCodes)[number]

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(5000),
  source: z.string().trim().min(1).max(80),
  pageUrl: z.url(),
  locale: z.enum(locales),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  consent: z.literal(true),
  companyWebsite: z.string().max(200).optional(),
  turnstileToken: z.string().min(1).max(2048),
})

export type LeadInput = z.infer<typeof leadSchema>

export function normalizePhone(input: string | undefined): string | null | undefined {
  const trimmed = input?.trim()
  if (!trimmed) return undefined
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_PHONE_COUNTRY)
  if (!parsed?.isValid()) return null
  return parsed.number
}
```

`parsePhoneNumberFromString` is still exported by `libphonenumber-js` 1.13.17. `parsed.number` is E.164. `null` means the visitor typed something that is not a phone number. `undefined` means they left it blank.

Set `DEFAULT_PHONE_COUNTRY` from `PROJECT.md`. The `satisfies CountryCode` check fails the build if the code is not a real region.

## Rate limit and hash

`src/features/leads/server/guard.ts`

```ts
import 'server-only'

import { createHash } from 'node:crypto'

import type { Payload } from 'payload'

const WINDOW_MS = 10 * 60 * 1000
const MAX_IN_WINDOW = 5

export function hashIp(ip: string): string | null {
  const salt = process.env.LEAD_IP_HASH_SALT
  if (!salt) return null
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first
  const real = headerList.get('x-real-ip')?.trim()
  return real || null
}

export async function isRateLimited(payload: Payload, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { totalDocs } = await payload.count({
    collection: 'leads',
    overrideAccess: true,
    where: {
      and: [{ ipHash: { equals: ipHash } }, { createdAt: { greater_than: since } }],
    },
  })
  return totalDocs >= MAX_IN_WINDOW
}
```

Two requests in the same instant can both pass the count. That is acceptable for this limiter. Do not add Redis. Do not log `ip` or `ipHash` together with the name or email.

The count uses `overrideAccess: true` because collection read is closed to the public. It does not return documents.

## Server action

`src/features/leads/actions.ts`

```ts
'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'

import { sendLeadNotification } from '@/lib/email'
import { appendLeadRow } from '@/lib/google'
import { getPayloadClient } from '@/lib/payload'
import { verifyTurnstile } from '@/lib/turnstile'

import { clientIp, hashIp, isRateLimited } from './server/guard'
import { leadSchema, normalizePhone, type LeadErrorCode, type LeadInput } from './schema'

export type ActionResult = { ok: true } | { ok: false; error: LeadErrorCode }

export async function submitLead(input: LeadInput): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  if (parsed.data.companyWebsite) return { ok: false, error: 'rejected' }

  const phone = normalizePhone(parsed.data.phone)
  if (phone === null) return { ok: false, error: 'invalid_phone' }

  const headerList = await headers()
  const ip = clientIp(headerList)
  if (!ip) return { ok: false, error: 'unavailable' }
  const ipHash = hashIp(ip)
  if (!ipHash) return { ok: false, error: 'unavailable' }

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip)
  if (!turnstile) return { ok: false, error: 'verification_failed' }

  const payload = await getPayloadClient()
  if (await isRateLimited(payload, ipHash)) return { ok: false, error: 'rate_limited' }

  const { companyWebsite: _honeypot, turnstileToken: _token, phone: _rawPhone, ...lead } = parsed.data
  const created = await payload.create({
    collection: 'leads',
    overrideAccess: true,
    data: {
      ...lead,
      phone,
      consentAt: new Date().toISOString(),
      status: 'new',
      ipHash,
    },
  })

  after(async () => {
    const results = await Promise.allSettled([
      sendLeadNotification(created.id),
      appendLeadRow(created.id),
    ])
    for (const result of results) {
      if (result.status === 'rejected') {
        payload.logger.error(`lead ${created.id} follow-up failed: ${result.reason instanceof Error ? result.reason.name : 'error'}`)
      }
    }
  })

  return { ok: true }
}
```

`overrideAccess: true` is deliberate: `create` access is false, and this action is the only writer, after the checks above. Do not pass the visitor as `user`.

`sendLeadNotification` and `appendLeadRow` are defined in the `payload-integrations` skill. They load the lead by id on the server. The `after()` callback must not log the row.

Import order in the action: the `'use server'` directive stays first. Keep `next/headers` and `next/server` before the `@/` imports.

## Form

`src/features/leads/components/LeadForm.tsx`

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useMutation } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'

import { locales, type AppLocale } from '@/i18n/locales'

import { submitLead } from '../actions'
import { leadSchema, type LeadErrorCode, type LeadInput } from '../schema'

function isLocale(value: string): value is AppLocale {
  for (const locale of locales) {
    if (locale === value) return true
  }
  return false
}

function messageFor(code: LeadErrorCode, t: ReturnType<typeof useTranslations>): string {
  switch (code) {
    case 'invalid_input':
      return t('invalidInput')
    case 'invalid_phone':
      return t('invalidPhone')
    case 'rejected':
      return t('rejected')
    case 'verification_failed':
      return t('verificationFailed')
    case 'rate_limited':
      return t('rateLimited')
    case 'unavailable':
      return t('unavailable')
    default: {
      const unhandled: never = code
      throw new Error(`Unhandled lead error: ${String(unhandled)}`)
    }
  }
}

export function LeadForm({ source }: { source: string }) {
  const t = useTranslations('leads')
  const currentLocale = useLocale()
  const locale = isLocale(currentLocale) ? currentLocale : locales[0]
  const turnstile = useRef<TurnstileInstance>(null)
  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: { source, locale, companyWebsite: '' },
  })
  const mutation = useMutation({
    mutationFn: submitLead,
    onSuccess: (result) => {
      if (result.ok) form.reset({ source, locale, companyWebsite: '' })
      turnstile.current?.reset()
    },
  })

  if (!isLocale(currentLocale)) return null

  return (
    <form
      noValidate
      className="relative grid gap-4 text-start"
      onSubmit={form.handleSubmit((values) => {
        const params = new URLSearchParams(window.location.search)
        mutation.mutate({
          ...values,
          source,
          locale,
          pageUrl: window.location.href,
          utmSource: params.get('utm_source') ?? undefined,
          utmMedium: params.get('utm_medium') ?? undefined,
          utmCampaign: params.get('utm_campaign') ?? undefined,
          utmTerm: params.get('utm_term') ?? undefined,
          utmContent: params.get('utm_content') ?? undefined,
        })
      })}
    >
      <div className="absolute -start-[9999px]" aria-hidden="true">
        <label htmlFor="companyWebsite">{t('companyWebsite')}</label>
        <input id="companyWebsite" tabIndex={-1} autoComplete="off" {...form.register('companyWebsite')} />
      </div>

      <label htmlFor="name">{t('name')}</label>
      <input id="name" aria-invalid={Boolean(form.formState.errors.name)} aria-describedby="name-error" {...form.register('name')} />
      {form.formState.errors.name && <p id="name-error" role="alert">{t('nameError')}</p>}

      <label htmlFor="email">{t('email')}</label>
      <input id="email" type="email" autoComplete="email" aria-invalid={Boolean(form.formState.errors.email)} aria-describedby="email-error" {...form.register('email')} />
      {form.formState.errors.email && <p id="email-error" role="alert">{t('emailError')}</p>}

      <label htmlFor="phone">{t('phone')}</label>
      <input id="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(form.formState.errors.phone)} aria-describedby="phone-error" {...form.register('phone')} />
      {form.formState.errors.phone && <p id="phone-error" role="alert">{t('invalidPhone')}</p>}

      <label htmlFor="message">{t('message')}</label>
      <textarea id="message" aria-invalid={Boolean(form.formState.errors.message)} aria-describedby="message-error" {...form.register('message')} />
      {form.formState.errors.message && <p id="message-error" role="alert">{t('messageError')}</p>}

      <label className="flex items-start gap-2">
        <input type="checkbox" {...form.register('consent')} />
        <span>{t('consent')}</span>
      </label>
      {form.formState.errors.consent && <p role="alert">{t('consentError')}</p>}

      <Turnstile
        ref={turnstile}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
        options={{ action: 'lead_submit', theme: 'auto' }}
        onSuccess={(token) => form.setValue('turnstileToken', token, { shouldValidate: true })}
        onExpire={() => form.setValue('turnstileToken', '')}
        onError={() => form.setValue('turnstileToken', '')}
      />
      {form.formState.errors.turnstileToken && <p role="alert">{t('verificationFailed')}</p>}

      <button type="submit" disabled={mutation.isPending}>{t('submit')}</button>
      {mutation.data && !mutation.data.ok && <p role="alert">{messageFor(mutation.data.error, t)}</p>}
      {mutation.data?.ok && <p role="status">{t('success')}</p>}
    </form>
  )
}
```

Read `pageUrl` and the UTM params inside the submit handler, not during render. `useSearchParams` would require a Suspense boundary and is unnecessary here.

Add the same keys to every file in `src/i18n/messages/`. The Arabic file uses the same keys. Write the Arabic values in the client project. This skills repo cannot contain that script. Do not leave the Arabic locale in English.

`src/i18n/messages/en.json` (merge into the existing object):

```json
{
  "leads": {
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "message": "Message",
    "consent": "I agree to be contacted about this enquiry.",
    "companyWebsite": "Company website",
    "submit": "Send",
    "success": "Thank you. We have received your message.",
    "nameError": "Enter your name.",
    "emailError": "Enter a valid email address.",
    "messageError": "Enter a message.",
    "consentError": "Consent is required.",
    "invalidInput": "Check the form and try again.",
    "invalidPhone": "Enter a valid phone number.",
    "rejected": "The form could not be sent.",
    "verificationFailed": "The verification check failed. Try again.",
    "rateLimited": "Too many messages from this network. Try again later.",
    "unavailable": "The form is temporarily unavailable."
  }
}
```

The honeypot error and the validation error use different sentences so a person can retry, and neither sentence says which hidden field failed.

`locale` passed to `submitLead` must be one of `locales`. `useLocale()` returns that union when `src/i18n/request.ts` is set up as in the `payload-localization` skill. If TypeScript widens it to `string`, narrow it with a type guard before calling the action. Do not cast.

## Status labels

Anywhere the UI prints `status`, switch on the union from the generated `Lead` type and use a `never` default. Do not keep a parallel list of status strings in the component.
