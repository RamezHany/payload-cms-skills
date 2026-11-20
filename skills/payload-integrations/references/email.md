# Email

Payload's email overview (3.x) is the source for the adapter option names: https://payloadcms.com/docs/email/overview

## Resend (default)

`pnpm add @payloadcms/email-resend@<same version as payload>`

In `src/payload.config.ts`:

```ts
import { resendAdapter } from '@payloadcms/email-resend'

email: resendAdapter({
  defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || '',
  defaultFromName: process.env.EMAIL_FROM_NAME || '',
  apiKey: process.env.RESEND_API_KEY || '',
}),
```

The from-address must be on a domain Resend has verified. Until that domain is verified, confirm Resend's current sandbox rule in their docs before expecting delivery to an arbitrary inbox.

## Mailgun

`pnpm add @payloadcms/email-nodemailer@<same version as payload>`

```ts
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

email: nodemailerAdapter({
  defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || '',
  defaultFromName: process.env.EMAIL_FROM_NAME || '',
  transportOptions: {
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
}),
```

`SMTP_HOST` is `smtp.mailgun.org` or `smtp.eu.mailgun.org`, matching the region of the sending domain. `SMTP_USER` and `SMTP_PASS` are the SMTP credentials for that domain (Sending, Domain settings, SMTP credentials), not the account API key. Port 587 uses STARTTLS. Leave `secure` unset. Use port 465 and `secure: true` only if 587 is blocked.

Passing nothing to `nodemailerAdapter()` uses Ethereal and logs a preview URL. That is a local fallback, not a production config.

## DNS

In the provider's domain screen, copy the records they show. Typical names, with values taken from that screen:

| Record | Host | Purpose |
| --- | --- | --- |
| TXT | the sending domain | SPF. One TXT record only. Merge `include:` into an existing SPF record |
| TXT or CNAME | the DKIM selector the provider names | DKIM |
| TXT | `_dmarc` | DMARC. Add `p=none` only when the domain has no DMARC record yet |

Wait until the provider shows the domain as verified before sending the launch test.

## Sending

`src/lib/email.ts`

```ts
import 'server-only'

import { locales, type AppLocale } from '@/i18n/locales'
import { getPayloadClient } from '@/lib/payload'

function isAppLocale(value: string): value is AppLocale {
  for (const locale of locales) {
    if (locale === value) return true
  }
  return false
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function copy(locale: AppLocale): { subject: string; intro: string } {
  switch (locale) {
    case 'en':
      return { subject: 'New lead', intro: 'A new lead was submitted.' }
    case 'ar':
      return { subject: 'New lead', intro: 'A new lead was submitted.' }
    default: {
      const unhandled: never = locale
      throw new Error(`Unhandled locale: ${String(unhandled)}`)
    }
  }
}

export async function sendLeadNotification(leadId: number | string): Promise<void> {
  const to = process.env.LEAD_NOTIFY_EMAIL
  if (!to) return

  const payload = await getPayloadClient()
  const lead = await payload.findByID({
    collection: 'leads',
    id: leadId,
    depth: 0,
    overrideAccess: true,
  })
  if (!lead) return

  if (typeof lead.locale !== 'string' || !isAppLocale(lead.locale)) return
  const text = copy(lead.locale)
  const html = `<p>${escapeHtml(text.intro)}</p>
<ul>
<li>${escapeHtml(lead.name)}</li>
<li>${escapeHtml(lead.email)}</li>
<li>${escapeHtml(lead.phone ?? '')}</li>
<li>${escapeHtml(lead.source)}</li>
<li>${escapeHtml(lead.pageUrl ?? '')}</li>
</ul>
<p>${escapeHtml(lead.message)}</p>`

  await payload.sendEmail({ to, subject: text.subject, html })
}
```

Before launch, replace the `ar` strings in the client project with the Arabic translation. Keep the `never` branch.

`payload.sendEmail` accepts `to`, `subject`, and `html` or `text`. Call it from `after()`, not before the action returns. The HTML escapes every visitor-supplied string. Do not put the IP hash or the Turnstile token in the message.

Plain HTML is enough for a notification. Do not add React Email. It is another package and another render step for a single internal message.

If `LEAD_NOTIFY_EMAIL` is empty, skip sending and leave the lead saved. The form must not fail because mail is not configured yet.
