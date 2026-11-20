# Site settings

`src/globals/SiteSettings/config.ts`:

```ts
import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { hasRole } from '@/access/hasRole'

import { revalidateSiteSettings } from './hooks/revalidateSiteSettings'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: anyone,
    update: hasRole('admin', 'editor'),
  },
  admin: {
    group: 'Settings',
  },
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
  fields: [
    { name: 'siteName', type: 'text', required: true, localized: true },
    { name: 'siteDescription', type: 'textarea', required: true, localized: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },
    {
      name: 'socialProfiles',
      type: 'array',
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok', 'snapchat', 'whatsapp'],
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
    { name: 'contactEmail', type: 'email' },
    {
      name: 'contactPhone',
      type: 'text',
      admin: { description: 'International form, for example +201234567890.' },
    },
    {
      name: 'organizationKind',
      type: 'select',
      required: true,
      defaultValue: 'organization',
      options: [
        { label: 'Organization', value: 'organization' },
        { label: 'Local business', value: 'local-business' },
      ],
    },
    { name: 'legalName', type: 'text', localized: true },
    {
      name: 'address',
      type: 'group',
      admin: {
        condition: (data) => data.organizationKind === 'local-business',
      },
      fields: [
        { name: 'streetAddress', type: 'text', localized: true },
        { name: 'addressLocality', type: 'text', localized: true },
        { name: 'addressRegion', type: 'text' },
        { name: 'postalCode', type: 'text' },
        {
          name: 'addressCountry',
          type: 'text',
          admin: { description: 'ISO 3166-1 alpha-2, for example EG.' },
        },
      ],
    },
    {
      name: 'aiCrawlerPolicy',
      type: 'select',
      required: true,
      defaultValue: 'allow-all',
      options: [
        { label: 'Allow all', value: 'allow-all' },
        { label: 'Allow answer engines, block training', value: 'allow-answer-block-training' },
        { label: 'Block AI crawlers', value: 'block-all' },
      ],
      admin: {
        description: 'Confirm the choice with the client. See the AI crawler reference for what each token does.',
      },
    },
    {
      name: 'searchConsoleVerification',
      type: 'text',
      admin: { description: 'The token only, not the full meta tag. It is published in the page head.' },
    },
    {
      name: 'gdprBadgeEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable only after the client confirms the site meets the standard they name. Defaults off.',
      },
    },
    {
      name: 'gdprBadgeLabel',
      type: 'text',
      localized: true,
      admin: { description: 'The client writes this sentence. Leave it empty until they do.' },
    },
  ],
}
```

Register the global in `src/payload.config.ts`. Run `pnpm generate:types`.

`contactEmail` uses Payload's `email` field type. Do not add a regex.

## Cached read

`src/globals/SiteSettings/getSiteSettings.ts`:

```ts
import 'server-only'

import { unstable_cache } from 'next/cache'

import type { AppLocale } from '@/i18n/locales'
import { getPayloadClient } from '@/lib/payload'
import { globalTag } from '@/utilities/revalidation'

export const getSiteSettings = (locale: AppLocale) =>
  unstable_cache(
    async () => {
      const payload = await getPayloadClient()
      return payload.findGlobal({ slug: 'site-settings', depth: 1, locale })
    },
    ['site-settings', locale],
    { tags: [globalTag('site-settings')] },
  )()
```

The locale is part of the cache key. The tag is shared so one save refreshes every locale.

## Hook

`src/globals/SiteSettings/hooks/revalidateSiteSettings.ts`:

```ts
import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook } from 'payload'

import { globalTag } from '@/utilities/revalidation'

export const revalidateSiteSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc
  // Site name, description, logo, and Organization JSON-LD render in the locale layout on every route.
  // One edit regenerates all routes x locales. These edits are rare.
  revalidateTag(globalTag('site-settings'), { expire: 0 })
  req.payload.logger.info('revalidate (global_site-settings): all routes that render site settings, plus robots.txt')
  return doc
}
```

Do not call `revalidatePath` with `'layout'`. Robots and metadata read this tag, so they refresh with the same save.
