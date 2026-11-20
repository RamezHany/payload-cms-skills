# Trust center

A separate global keeps a subprocessors edit on `/trust` only. Site-settings is layout data and is the wrong place for a list that changes when a vendor is added.

## Global

`src/globals/TrustCenter/config.ts`:

```ts
import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { hasRole } from '@/access/hasRole'

import { revalidateTrustCenter } from './hooks/revalidateTrustCenter'

export const TrustCenter: GlobalConfig = {
  slug: 'trust-center',
  label: 'Trust center',
  access: {
    read: anyone,
    update: hasRole('admin', 'editor'),
  },
  admin: { group: 'Settings' },
  hooks: { afterChange: [revalidateTrustCenter] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'intro', type: 'textarea', localized: true },
    { name: 'lastReviewed', type: 'date', required: true },
    {
      name: 'subprocessors',
      type: 'array',
      required: true,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'purpose', type: 'text', required: true },
        {
          name: 'dataLocation',
          type: 'text',
          admin: { description: 'Region from PROJECT.md. Leave empty until the client confirms it.' },
        },
        { name: 'privacyUrl', type: 'text', required: true },
      ],
    },
    {
      name: 'practices',
      type: 'array',
      fields: [{ name: 'statement', type: 'textarea', required: true }],
      admin: {
        description: 'Statements that are true of this repository. No certification names unless the client provides the certificate.',
      },
    },
    { name: 'dataRequestEmail', type: 'email', required: true },
    { name: 'dataRequestNote', type: 'textarea', localized: true },
  ],
}
```

Hook, `src/globals/TrustCenter/hooks/revalidateTrustCenter.ts`:

```ts
import type { GlobalAfterChangeHook } from 'payload'

import { applyRevalidation, localizedPaths, sitemapTag } from '@/utilities/revalidation'

export const revalidateTrustCenter: GlobalAfterChangeHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc
  // The trust page is a single route. pages-sitemap lists /trust, so the sitemap cache refreshes too.
  applyRevalidation(
    {
      reason: 'trust-center',
      paths: localizedPaths('/trust'),
      tags: [sitemapTag('pages')],
    },
    req.payload,
  )
  return doc
}
```

Show `lastReviewed` on the page with the same date formatter as legal pages.

## Rows to prefill

Keep a row only when that provider is in use. Open `privacyUrl`. If it does not load a privacy or DPA page, replace it with the current page linked from the vendor's own footer. These starting points were the vendors' public legal pages at the time of writing; they are not a substitute for opening them.

| Provider | Purpose to write | Starting URL |
| --- | --- | --- |
| Vercel | Hosting | https://vercel.com/legal/privacy-policy |
| Turso | Database (libSQL) | https://turso.tech/ |
| Cloudinary | Image and file storage | https://cloudinary.com/privacy |
| Cloudflare | R2 object storage, Turnstile, or both. Name the products that are enabled | https://www.cloudflare.com/privacypolicy/ |
| Resend | Transactional email | https://resend.com/legal/privacy-policy |
| Mailgun | Transactional email | https://www.mailgun.com/legal/privacy-policy |
| Google | The Google products the site enables (Analytics, Search Console, Calendar, Sheets, Drive) | https://policies.google.com/privacy |
| Mux | Video hosting | https://www.mux.com/privacy |
| Stripe | Card payments | https://stripe.com/privacy |
| PayPal | Payments | https://www.paypal.com/legalhub/privacy-full |

One Cloudflare row covers R2 and Turnstile. One Google row lists every Google product in use. Other payment gateways get a row only after you load that vendor's privacy page. Do not invent the URL.

`dataLocation`: copy the region the client already chose (for example the Vercel function region and the Turso region in `PROJECT.md`). A vendor's headquarters is not the data location.

## Practices you may list

Only these, and only when the code does them:

- Admin accounts use the roles from `payload-auth-rbac`.
- Secrets stay in the environment, not in the repository.
- Draft preview requires the preview secret and a logged-in user.
- Analytics and marketing scripts wait for consent.
- Public forms are validated again on the server.

Anything about encryption at rest, SOC 2, ISO 27001, or a penetration test waits for a document the client provides. The intro text is also theirs. A factual intro you may suggest, which they must approve: which organization runs the site, how to reach `dataRequestEmail`, and that the table names the providers that process personal data for this site.
