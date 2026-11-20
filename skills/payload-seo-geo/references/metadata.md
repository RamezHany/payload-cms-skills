# Metadata

Plugin types checked against `@payloadcms/plugin-seo` on the Payload 3.x line: `GenerateTitle` and `GenerateURL` receive `locale?: string`. The website template calls `seoPlugin({ generateTitle, generateURL })` from `src/plugins/index.ts`.

## Plugin

```ts
import type { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'

import type { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

type PublicCollection = 'pages' | 'posts' | 'legal-pages' | 'services'

function isPublicCollection(slug: string | null | undefined): slug is PublicCollection {
  return slug === 'pages' || slug === 'posts' || slug === 'legal-pages' || slug === 'services'
}

export function publicPath(collection: PublicCollection, slug: string): string {
  switch (collection) {
    case 'pages':
      return slug === 'home' ? '' : `/${slug}`
    case 'posts':
      return `/posts/${slug}`
    case 'legal-pages':
      return `/legal/${slug}`
    case 'services':
      return `/services/${slug}`
    default: {
      const unhandled: never = collection
      throw new Error(`Unhandled collection: ${String(unhandled)}`)
    }
  }
}

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => doc?.title ?? ''

const generateURL: GenerateURL<Post | Page> = ({ doc, collectionSlug, locale }) => {
  const slug = typeof doc?.slug === 'string' ? doc.slug : ''
  const path = isPublicCollection(collectionSlug) && slug ? publicPath(collectionSlug, slug) : ''
  const prefix = locale ? `/${locale}` : ''
  return `${getServerSideURL()}${prefix}${path}`
}
```

```ts
seoPlugin({
  collections: ['pages', 'posts', 'legal-pages', 'services'],
  uploadsCollection: 'media',
  generateTitle,
  generateURL,
})
```

After localization is on, confirm in the admin that `meta.title` and `meta.description` show a locale toggle. When they do not, map those two fields in the plugin `fields` override and set `localized: true`. Leave `meta.image` unlocalized unless `PROJECT.md` asks for a different share image per language.

`generateTitle` fills the admin suggestion. The frontend layout template appends the site name, so this function stays a bare title.

## Image URL

The template's `getImageURL` prefixes `serverUrl` onto `image.url`. Cloudinary and R2 URLs are already absolute, and prefixing them produces a broken Open Graph URL. Replace that helper:

```ts
export function absoluteMediaUrl(url: string, serverUrl: string): string {
  if (url.startsWith('https://') || url.startsWith('http://')) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${serverUrl}${path}`
}
```

Prefer `image.sizes.og.url` when that size exists, then `image.url`. The `payload-media` skill removes `imageSizes`; the `url` branch is the one that remains.

## Layout metadata

In `src/app/(frontend)/[locale]/layout.tsx`:

```ts
import type { Metadata } from 'next'

import { getSiteSettings } from '@/globals/SiteSettings/getSiteSettings'
import { isAppLocale } from '@/i18n/locales'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: requested } = await params
  if (!isAppLocale(requested)) return {}
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
  if (!serverUrl) throw new Error('NEXT_PUBLIC_SERVER_URL is required')

  const settings = await getSiteSettings(requested)
  const token = settings.searchConsoleVerification?.trim()

  return {
    metadataBase: new URL(serverUrl),
    title: {
      default: settings.siteName,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.siteDescription,
    verification: token ? { google: token } : undefined,
  }
}
```

Add `isAppLocale` next to the locale list:

```ts
export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value)
}
```

`metadata.verification.google` renders `<meta name="google-site-verification">`. Checked against the Next.js Metadata API.

## Page metadata

Extend `generateMeta` so it receives the active locale and the locale-free path (`''` for home, `'/posts/hello'` for a post). Return:

- `title`: the page title only. The layout template adds the site name. Open Graph and Twitter titles are `${pageTitle} | ${siteName}`, because those tags do not use `title.template`.
- `description`: `meta.description`, then the document excerpt, then `siteDescription`.
- `alternates.canonical`: `/${locale}${path}`.
- `alternates.languages`: one entry per `locales` code, plus `'x-default'` pointing at `/${defaultLocale}${path}`.
- `openGraph` and `twitter`: `summary_large_image`, the shared image, and `openGraph.locale`.

```ts
const openGraphLocale: Record<AppLocale, string> = {
  en: 'en_US',
  ar: 'ar_EG', // replace with the region recorded in PROJECT.md
}
```

hreflang values stay `en` and `ar`, matching the route locales. `x-default` is the default-locale URL. Google documents `x-default` for the fallback version: [localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).

Next.js documents `alternates.languages` as a map of hreflang values to paths. The metadata page's examples use locale keys and do not mention `x-default`. Put `x-default` in that map, then view source. When the tag is missing, render `<link rel="alternate" hrefLang="x-default" href={defaultUrl} />` from the locale layout and keep the locale entries in `alternates.languages`.

Call `setRequestLocale` and pass `locale` into `payload.find` before building metadata, or the alternate URLs describe the right paths while the title is in the wrong language.
