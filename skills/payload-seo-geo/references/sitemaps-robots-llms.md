# Sitemaps, robots hosting, and llms.txt

## Sitemaps

The website template (Payload 3.x branch) keeps handlers at:

- `src/app/(frontend)/(sitemaps)/pages-sitemap.xml/route.ts`
- `src/app/(frontend)/(sitemaps)/posts-sitemap.xml/route.ts`

Each wraps a query in `unstable_cache` with tag `pages-sitemap` or `posts-sitemap`, then `return getServerSideSitemap(fields)`. `next-sitemap` 4.2.3 types `ISitemapField.alternateRefs` as `{ href, hreflang, hrefIsAbsolute? }[]`. Set `hrefIsAbsolute: true`. The template depends on `next-sitemap` `^4.2.3`.

`src/utilities/localizedSitemap.ts`:

```ts
import type { ISitemapField } from 'next-sitemap'

import { defaultLocale, locales, type AppLocale } from '@/i18n/locales'

function absolute(siteUrl: string, locale: AppLocale, path: string): string {
  return `${siteUrl}/${locale}${path}`
}

export function localizedSitemapFields(args: {
  siteUrl: string
  path: string
  lastmod: string
}): ISitemapField[] {
  const alternates = [
    ...locales.map((locale) => ({
      href: absolute(args.siteUrl, locale, args.path),
      hreflang: locale,
      hrefIsAbsolute: true,
    })),
    {
      href: absolute(args.siteUrl, defaultLocale, args.path),
      hreflang: 'x-default',
      hrefIsAbsolute: true,
    },
  ]

  return locales.map((locale) => ({
    loc: absolute(args.siteUrl, locale, args.path),
    lastmod: args.lastmod,
    alternateRefs: alternates,
  }))
}
```

`path` is `''` for home, `'/posts/hello'`, `'/legal/privacy'`, `'/services/consult'`. Because `localePrefix` is `always`, do not emit the unprefixed URL.

Query once, without a locale (slugs are shared). Select `slug` and `updatedAt`. Page with `pagination: false` only when `totalDocs` is at most 1000. When it is higher, loop `page` until every published document is included. The template's single `limit: 1000` drops the rest.

Map slugs with `publicPath` from [metadata.md](metadata.md). Static entries on the pages sitemap, each expanded per locale: `''` (home), `'/posts'`, `'/search'`, and `'/trust'` when the trust route exists. Use the document `updatedAt` for `lastmod`. The same timestamp is correct for every locale; Payload stores one `updatedAt` per document.

Copy the pages handler for `legal-pages-sitemap.xml` and `services-sitemap.xml`. Tags are `sitemapTag('legal-pages')` and `sitemapTag('services')`, which resolve to `legal-pages-sitemap` and `services-sitemap`.

In `next-sitemap.config.cjs`, add those URLs to `robotsTxtOptions.additionalSitemaps` only if `generateRobotsTxt` stays true. This skill turns it off in the AI crawler reference, and `robots.ts` lists the sitemap URLs instead. Keep `exclude` so the generated `sitemap.xml` does not duplicate the dynamic handlers.

Submitting sitemaps: give Search Console the dynamic files (`/pages-sitemap.xml`, `/posts-sitemap.xml`, and the others), which are the ones with locale URLs.

## llms.txt

Spec, checked at [llmstxt.org](https://llmstxt.org/) on 2026-11-20 (v2, updated 10 August 2026). Order:

1. H1, the site name in the default locale. This is the only required part.
2. A blockquote with the default-locale site description.
3. H2 sections. Under each, a markdown list. Each item is `- [name](url): note`.
4. An H2 titled exactly `Optional` is reserved for links an agent may skip. Do not use that heading for a language.

The spec prefers links to markdown copies of pages. This project lists the canonical HTML URL, because pages are CMS documents. `/llms-full.txt` is the full-text file. Do not add per-page `.md` routes.

`src/app/llms.txt/route.ts`:

```ts
import { defaultLocale, locales, localeLabels, type AppLocale } from '@/i18n/locales'
import { getPayloadClient } from '@/lib/payload'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-static'

export async function GET() {
  const body = await renderLlmsTxt()
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

`renderLlmsTxt` is the function in this file that runs the queries below and returns the markdown. For body text, import `convertLexicalToPlaintext` from `@payloadcms/richtext-lexical/plaintext` and call `convertLexicalToPlaintext({ data })`. That export and argument shape are from version 3.94.0. Use it for the one-line description when the document has no `meta.description` and no summary: take the first line, cap it near 160 characters. For `/llms-full.txt`, print the plaintext under the link, capped at 8000 characters per document, and say in the file when a body was cut.

Do not call `draftMode`, `cookies`, or `headers` in this route. Loop `locales` and pass `locale` to `payload.find`. `draft: false`, `_status: published`, `overrideAccess: false`, `depth: 0`. Paginate. Cap each collection at 500 links and end that section with the collection index URL when the cap hits, so the file stays a curated overview.

One-line helper, no regular expressions:

```ts
function oneLine(value: string): string {
  return value.replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('[', '(').replaceAll(']', ')')
}
```

H2 text is the English language name from `localeLabels` (`English`, `Arabic`), so the file structure stays stable. The link title is the localized CMS title.

Home (`slug === 'home'`) links to `/${locale}`. Other paths use `publicPath`.

The build must reach the database, the same requirement static pages already have.

## Aliases

On the `nextConfig` object passed to `withPayload`:

```ts
async rewrites() {
  return [
    { source: '/llm.txt', destination: '/llms.txt' },
    { source: '/llms', destination: '/llms.txt' },
    { source: '/llm', destination: '/llms.txt' },
  ]
},
```

If `rewrites` already exists, append these three. Do not replace redirects that are already configured.

`src/proxy.ts` already excludes `llms` and `llm`. Keep both. A slug must not start with `llm` or `llms`.

## Targets

Inside the existing targets function for pages, posts, services, and legal-pages:

```ts
paths: [
  ...localizedPaths(`/posts/${post.slug}`),
  '/llms.txt',
  // include the next line only when src/app/llms-full.txt/route.ts exists
  '/llms-full.txt',
],
```

`/llms.txt` is outside `[locale]`. `localizedPaths('/llms.txt')` would revalidate `/en/llms.txt` and miss the real route.

Sitemap tags stay as they are (`posts-sitemap` on post targets, and the matching tag on the other collections). Do not add an `llms` cache tag, and do not put these paths on the layout.
