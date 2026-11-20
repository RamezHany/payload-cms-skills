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
