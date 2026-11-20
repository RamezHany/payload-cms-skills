# JSON-LD

`src/components/JsonLd.tsx` is a Server Component. Builders return nodes without `@context`. The component adds `@context` and `@graph`.

```tsx
type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export function JsonLd({ data }: JsonLdProps) {
  const graph = Array.isArray(data) ? data : [data]
  const json = {
    '@context': 'https://schema.org',
    '@graph': graph,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replaceAll('<', '\\u003c'),
      }}
    />
  )
}
```

`replaceAll` is a string replace, not a regular expression. Drop nodes that are `null` before passing `data`.

## When to emit

| Builder | Emit when | Omit when |
| --- | --- | --- |
| Organization | `organizationKind` is `organization`, or local business is missing street, city, or country | Name is empty |
| LocalBusiness | Kind is `local-business` and street, city, and country are filled | Address is incomplete. Fall back to Organization |
| WebSite | Site name and `NEXT_PUBLIC_SERVER_URL` exist | Never add `potentialAction` or `SearchAction` |
| BreadcrumbList | At least two crumbs (home and current) | A single crumb |
| BlogPosting | Post has title, absolute image URL, and `publishedAt` | Any of those is missing |
| Service | Service title and description exist | The page is not a service |
| FAQPage | The page shows each question and exactly one answer | The FAQ is collapsed into text the visitor cannot open, or answers are missing |
| Person | A CMS field has the author's name | You would have to invent the name |

Read the posts collection for the author field the template already has, and pass that name through. Do not add a second author field for schema.

`dateModified` is `updatedAt` on posts and `lastUpdated` on legal pages, as an ISO string. `datePublished` is the document's published date. Both must match the dates visible on the page.

## Nodes

`src/utilities/jsonLd.ts`. Keep imports at the top of the file. `siteUrl` has no trailing slash.

Organization `@id` is `${siteUrl}/#organization`. WebSite `@id` is `${siteUrl}/#website`. Other nodes point `publisher` or `provider` at the organization `@id`.

The locale layout renders both nodes in one `JsonLd`, so the page has one `application/ld+json` script with `@graph`. Values come from the `site-settings` global the admin edits. Do not hardcode a name, a logo URL, or a social profile.

```ts
import { z } from 'zod'

import { absoluteMediaUrl } from '@/utilities/generateMeta'
import { locales } from '@/i18n/locales'

type SocialProfile = { url?: string | null }
type MediaUpload = { url?: string | null }

type SiteSettingsJsonLd = {
  siteName?: string | null
  siteDescription?: string | null
  legalName?: string | null
  logo?: MediaUpload | string | null
  socialProfiles?: SocialProfile[] | null
}

export function organizationNode(settings: SiteSettingsJsonLd, siteUrl: string) {
  const name = settings.legalName || settings.siteName
  if (!name || !siteUrl) return null

  const sameAs = (settings.socialProfiles ?? [])
    .map((profile) => profile.url ?? '')
    .filter((url) => z.url().safeParse(url).success)

  const rawLogo = settings.logo && typeof settings.logo === 'object' ? settings.logo.url : undefined
  const logo = rawLogo ? absoluteMediaUrl(rawLogo, siteUrl) : undefined

  return {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name,
    url: siteUrl,
    ...(settings.siteDescription ? { description: settings.siteDescription } : {}),
    ...(logo ? { logo } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }
}

export function websiteNode(settings: SiteSettingsJsonLd, siteUrl: string) {
  if (!settings.siteName || !siteUrl) return null
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: settings.siteName,
    url: siteUrl,
    ...(settings.siteDescription ? { description: settings.siteDescription } : {}),
    inLanguage: [...locales],
    publisher: { '@id': `${siteUrl}/#organization` },
  }
}
```

In `src/app/(frontend)/[locale]/layout.tsx`, after `getSiteSettings(locale)`:

```tsx
const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
const graph = [organizationNode(settings, siteUrl), websiteNode(settings, siteUrl)].filter((node) => node !== null)
```

Render `<JsonLd data={graph} />` only when `graph.length > 0`. `getSiteSettings` uses `depth: 1`, so `logo` is the media document. If it is still an id, omit `logo` instead of guessing a path.

`absoluteMediaUrl` is the helper in the metadata reference. A Cloudinary or R2 URL is already absolute. Do not prefix the site host onto it.

Organization fields, when present: `name` (`legalName` or `siteName`), `url`, `description`, `logo` (absolute), `email`, `telephone`, `sameAs` (the social profile URLs only).

LocalBusiness adds `@type: 'LocalBusiness'` and `address` with `@type: 'PostalAddress'` and the address fields. Do not invent `openingHours`, `geo`, `priceRange`, or a more specific subtype (`Dentist`, `Restaurant`) unless `PROJECT.md` names it.

WebSite fields: `name`, `url`, `description`, `inLanguage` set to the locale codes, `publisher`.

BreadcrumbList `itemListElement`: `@type: 'ListItem'`, `position` starting at 1, `name`, `item` as the absolute URL.

BlogPosting fields: `headline`, `image` as an array of one absolute URL, `datePublished`, `dateModified`, `inLanguage`, `mainEntityOfPage` as the canonical URL, `author` as `{ '@type': 'Person', name }`, `publisher` as the organization `@id`.

Service fields: `name`, `description`, `url`, `provider`. Add `areaServed` only when `addressCountry` is set.

FAQPage `mainEntity`: `{ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } }`. The strings are the visible question and answer, with HTML stripped by taking the plain text the page already renders.

Person fields are limited to values stored on the author: `name`, and `url` or `jobTitle` only when those fields exist.

## Where they render

| Page | Nodes |
| --- | --- |
| Locale layout | Organization or LocalBusiness, and WebSite |
| Post | BreadcrumbList and BlogPosting |
| Service | BreadcrumbList and Service |
| A real FAQ page | BreadcrumbList and FAQPage |
| Other pages | BreadcrumbList |

Home, layout nodes, and the page nodes can be one `@graph`. The layout component and the page component may each render their own `JsonLd`. Two script tags are valid.

## Rich results to re-check

- Article (BlogPosting): [article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- Breadcrumbs: [breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- Local business: [local business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- FAQ withdrawal, 7 May 2026: Search Central changelog entries "Deprecating the FAQ rich result feature" and "Removing documentation for the FAQ rich result feature". The 2023 limit to government and health sites is [this post](https://developers.google.com/search/blog/2023/08/howto-faq-changes). The May 2026 change removed the rest.
- Sitelinks search box removed: Search Central changelog. That is why WebSite has no `SearchAction`.

Validators: [Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/). A schema warning about FAQ eligibility is expected. Do not delete a visible FAQ node to clear it, and do not tell the client the FAQ will appear as a rich result.
