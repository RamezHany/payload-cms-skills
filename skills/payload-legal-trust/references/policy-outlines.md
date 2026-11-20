# Legal pages and outlines

## Collection

`src/collections/LegalPages/index.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'

import { revalidateLegalPage, revalidateLegalPageDelete } from './hooks/revalidateLegalPage'

export const LegalPages: CollectionConfig = {
  slug: 'legal-pages',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'effectiveDate', 'version', '_status'],
    livePreview: {
      url: ({ data, locale }) =>
        generatePreviewPath({
          collection: 'legal-pages',
          slug: typeof data?.slug === 'string' ? data.slug : null,
          locale: locale?.code,
        }),
    },
    preview: (data, { locale }) =>
      generatePreviewPath({
        collection: 'legal-pages',
        slug: typeof data?.slug === 'string' ? data.slug : null,
        locale,
      }),
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'summary',
      type: 'textarea',
      localized: true,
      admin: { description: 'One line for /llms.txt. The client writes it.' },
    },
    slugField(),
    {
      name: 'body',
      type: 'richText',
      localized: true,
      required: true,
    },
    { name: 'effectiveDate', type: 'date', required: true },
    { name: 'lastUpdated', type: 'date', required: true },
    { name: 'version', type: 'text', required: true },
  ],
  versions: {
    drafts: { autosave: { interval: 100 }, schedulePublish: true },
    maxPerDoc: 50,
  },
  hooks: {
    afterChange: [revalidateLegalPage],
    afterDelete: [revalidateLegalPageDelete],
  },
}
```

Use the same Lexical editor the `pages` collection uses. `slugField()` is the Payload 3 helper. Run `pnpm generate:types`, then type the hooks with the generated `LegalPage` type and the `revalidateOnPublish` / `revalidateOnDelete` factories.

`src/collections/LegalPages/hooks/legalPageTargets.ts`:

```ts
import type { PayloadRequest } from 'payload'

import type { LegalPage } from '@/payload-types'
import {
  docTag,
  localizedPaths,
  noTargets,
  sitemapTag,
  type RevalidationTargets,
} from '@/utilities/revalidation'

type LegalRef = Pick<LegalPage, 'slug'>

export function legalPageTargets(doc: LegalRef, _req: PayloadRequest): RevalidationTargets {
  if (!doc.slug) return noTargets
  return {
    reason: `legal-pages:${doc.slug}`,
    paths: [...localizedPaths(`/legal/${doc.slug}`), '/llms.txt'],
    tags: [docTag('legal-pages', doc.slug), sitemapTag('legal-pages')],
  }
}
```

Append `'/llms-full.txt'` when `src/app/llms-full.txt/route.ts` exists. The sitemap route itself is the pattern in the `payload-seo-geo` skill: tag `legal-pages-sitemap`, one `<loc>` per locale, `alternateRefs` included.

`src/collections/LegalPages/hooks/revalidateLegalPage.ts`:

```ts
import type { LegalPage } from '@/payload-types'

import { revalidateOnDelete, revalidateOnPublish } from '@/hooks/revalidateOnPublish'

import { legalPageTargets } from './legalPageTargets'

export const revalidateLegalPage = revalidateOnPublish<LegalPage>('legal-pages', legalPageTargets)
export const revalidateLegalPageDelete = revalidateOnDelete<LegalPage>(legalPageTargets)
```

Visible date line, labels in `messages/en.json`:

```json
{
  "legal": {
    "effective": "Effective {date}",
    "updated": "Last updated {date}",
    "version": "Version {version}"
  }
}
```

Format the stored ISO dates with `Intl.DateTimeFormat(locale, { dateStyle: 'long' })`.

## Outlines

Each heading is a topic the published page must cover. The body under it is whatever counsel wrote. Collect the facts in `PROJECT.md` first.

### Privacy policy (`privacy`)

Headings:

- Who we are
- What we collect
- Why we collect it
- Cookies
- Who receives data
- Where data is processed
- How long we keep it
- How to ask for access, correction, or deletion
- Children
- How to complain
- Changes to this policy

Facts to collect: legal name, address, privacy contact email, which forms exist, which analytics and marketing tools actually load, payment and email providers, retention for each category, whether the audience includes children, and the complaint body the lawyer names.

### Terms of service (`terms`)

Headings:

- Who this agreement is between
- What the site offers
- Accounts, when the site has them
- Acceptable use
- Intellectual property
- Bookings and payments, when offered
- Liability
- Governing law and venue
- Contact
- Changes to these terms

Facts to collect: the legal entity, what is being sold or booked, account rules, and the governing law and city the lawyer chooses.

### Cookie policy (`cookies`)

Headings:

- What cookies this site uses
- Necessary cookies
- Analytics cookies
- Marketing cookies
- How to change your choice
- How long the choice is stored

Facts to collect: the tools that load after consent, the consent cookie lifetime you configured (the library default is 182 days; state the number you actually set), and the footer control that reopens preferences. The categories must match the banner. A tool that loads must appear here. A category with no tool must say that nothing loads for it yet.

### Refund and cancellation (`refunds`)

Create this draft only when money or bookings exist. Headings:

- What can be cancelled
- The cancellation window
- How a refund is sent
- Fees
- Exceptions
- Contact

Facts to collect: the product or appointment types, the window, whether the same payment method is used, and any fee the lawyer has approved. Payment mechanics stay in `payload-bookings-payments`. This page only states the promise.

### Accessibility statement (`accessibility`)

Headings:

- The standard we aim for
- Known limitations
- How to request help
- When this statement was reviewed

Facts to collect: the level the client is willing to state, the barriers you found by using the site with a keyboard and a screen reader, and a contact email. If they have not picked a level, the heading stays "The standard we aim for" and the body says they have not published a conformance claim. Do not write "WCAG 2.2 AA" for them.
