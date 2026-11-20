# Data model

Standard collections and globals for the sites these skills target. Add only what `PROJECT.md` needs. The owning skill defines the exact fields.

## Collections

| Slug | Purpose | Drafts + live preview | Localized fields | Source |
| --- | --- | --- | --- | --- |
| `users` | Admins and editors with roles | No | No | template + `payload-auth-rbac` |
| `media` | Images and files | No | `alt`, `caption` | template + `payload-media` |
| `pages` | Block-based pages | Yes | Content fields | template |
| `posts` | Blog posts | Yes | Content fields | template |
| `categories` | Blog categories | No | `title` | template |
| `legal-pages` | Privacy, terms, cookies, refunds, and other policies | Yes | Content fields | `payload-legal-trust` |
| `leads` | Form submissions with CRM status | No | No | `payload-forms-crm` |
| `services` | Bookable consultation types with price and duration | No | `title`, `description` | `payload-bookings-payments` |
| `bookings` | Appointments with payment status | No | No | `payload-bookings-payments` |
| `payment-events` | Webhook log for idempotency | No | No | `payload-bookings-payments` |
| `mux-video` | Videos (created by the Mux plugin) | No | No | `payload-media` |
| `redirects`, `search`, `forms`, `form-submissions` | Created by template plugins | No | Varies | template |

## Globals

| Slug | Purpose | Source |
| --- | --- | --- |
| `header` | Navigation links | template |
| `footer` | Footer links, legal links, social links | template + `payload-legal-trust` |
| `site-settings` | Site name, logo, contact details, social profiles, default SEO image, AI summary prompt | `payload-seo-geo` |
| `booking-settings` | Weekly availability, buffer time, booking window, timezone | `payload-bookings-payments` |
| `consent-settings` | Cookie categories and banner text | `payload-legal-trust` |

## Field conventions

1. Every collection with a public URL has a `slug` field from `slugField()` (imported from `payload`) and SEO fields from `@payloadcms/plugin-seo`.
2. Keep `slug` unlocalized unless the brief requires translated URLs.
3. Every upload relationship to `media` sets `required` only when the frontend cannot render without it.
4. Use `admin.group` to keep the sidebar short: `Content`, `Leads & Bookings`, `Settings`.
5. Use `admin.useAsTitle` and `admin.defaultColumns` on every collection.
6. Enable `versions.drafts` with `autosave: { interval: 100 }` only on collections that need live preview.
7. Prefer `select` fields with string values for statuses, and mirror them in a TypeScript union.
8. Add `index: true` to fields used in `where` filters (slugs, statuses, dates). Add `unique: true` for natural keys (slugs, provider event IDs).

## Example: a localized collection with live preview

```ts
import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'

export const Services: CollectionConfig<'services'> = {
  slug: 'services',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'durationMinutes', 'updatedAt'],
    livePreview: {
      url: ({ data, locale }) =>
        generatePreviewPath({ collection: 'services', slug: data?.slug, locale: locale?.code }),
    },
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'price', type: 'number', required: true, min: 0 },
    { name: 'currency', type: 'select', required: true, defaultValue: 'EGP', options: ['EGP', 'USD', 'SAR', 'AED', 'KWD', 'EUR'] },
    { name: 'durationMinutes', type: 'number', required: true, defaultValue: 30, min: 15 },
    slugField(),
  ],
  versions: { drafts: { autosave: { interval: 100 } }, maxPerDoc: 20 },
}
```

`generatePreviewPath` with locale support is defined in the `payload-live-preview` skill.
