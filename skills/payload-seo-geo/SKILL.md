---
name: payload-seo-geo
description: SEO, AEO, and GEO for Payload CMS 3 and Next.js 16 - localized metadata, canonical and hreflang, JSON-LD, sitemaps, robots.txt AI crawler policies, llms.txt, and Summarize with AI links. Use when adding SEO, Open Graph, schema, sitemaps, robots, Search Console verification, llms.txt, or AI citation links.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload SEO and GEO

Produces a `site-settings` global, localized metadata, JSON-LD, sitemap alternates, a robots policy, `/llms.txt`, and Summarize with AI links.

Every absolute URL uses `NEXT_PUBLIC_SERVER_URL`: `https://`, no trailing slash. That is the canonical host. A `*.vercel.app` host is only acceptable when the client says that host is the public site.

## Step 1: Site settings

Add the global in [references/site-settings.md](references/site-settings.md). It renders in the locale layout (default title, description, and the Organization or LocalBusiness node), so its hook expires `global_site-settings` only, with the justification comment in that file.

| Choice | Use |
| --- | --- |
| `organization` | No public street address |
| `local-business` | Customers visit a real address. Emit LocalBusiness only when street, city, and country are filled |

Access: `read` for anyone, `update` for admin and editor (`payload-auth-rbac`). Group: `Settings`.

The GDPR badge fields live on this global. Rendering rules are in the `payload-legal-trust` skill. Default the checkbox to false.

## Step 2: Metadata

Follow [references/metadata.md](references/metadata.md).

1. In `src/plugins/index.ts`, set `seoPlugin` `collections` to `pages`, `posts`, `legal-pages`, and `services`, and `uploadsCollection` to `media`. `generateURL` includes the locale and the collection prefix. `generateTitle` returns the document title only.
2. Extend `src/utilities/generateMeta.ts`. Keep an already-absolute media URL absolute.
3. In `src/app/(frontend)/[locale]/layout.tsx`, set `metadataBase` from `NEXT_PUBLIC_SERVER_URL` and `title.template` to `%s | {siteName}` for the active locale.
4. Each public page sets `alternates.canonical` and `alternates.languages` for every code in `src/i18n/locales.ts`, plus `x-default` on the default locale. Open Graph and Twitter use `summary_large_image` and the same title, description, and image.
5. When `searchConsoleVerification` is non-empty, the layout metadata includes `verification.google`.

## Step 3: JSON-LD

Add `src/components/JsonLd.tsx` and `src/utilities/jsonLd.ts` from [references/json-ld.md](references/json-ld.md). Serialize with `JSON.stringify(data).replaceAll('<', '\\u003c')`.

Builders: Organization or LocalBusiness, WebSite, BreadcrumbList, BlogPosting, Service, FAQPage, Person. Emit a node only when its required values exist. The locale layout puts Organization and WebSite in one `JsonLd`, which is the `@graph` script. Site name, description, logo, and social profile URLs are the fields an admin edits under Settings, Site settings. Do not hardcode them. Name, address, and phone come from that same global.

Checked against Google Search Central on 2026-11-20. Re-open the [Search Gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) before telling a client a rich result will show.

| Node | What to expect |
| --- | --- |
| BlogPosting, BreadcrumbList, Organization, LocalBusiness | Documented rich results when required fields and visible content match |
| FAQPage | FAQ rich results stopped on 7 May 2026, including for government and health sites, and Google removed the FAQ documentation. Emit it only for a visible one-answer FAQ. It still helps answer engines read the page |
| WebSite, Service, Person | No rich-result promise. They name the entity for answer engines |
| HowTo, SearchAction | Do not emit. HowTo rich results and the sitelinks search box are gone |

## Step 4: Sitemaps

Keep `next-sitemap.config.cjs` and the handlers in `src/app/(frontend)/(sitemaps)/`. Rewrite each `<loc>` as a locale URL (`localePrefix: 'always'`) and add `alternateRefs` for every locale plus `x-default`. Implementation: [references/sitemaps-robots-llms.md](references/sitemaps-robots-llms.md).

The cache tag stays `<collection>-sitemap` (`sitemapTag` from `@/utilities/revalidation`). Only that collection's targets function expires it. Add `legal-pages-sitemap.xml` and `services-sitemap.xml` with the same pattern when those collections exist.

## Step 5: Robots and AI crawlers

Store the client's choice on `aiCrawlerPolicy`. Tokens, sources, and `src/app/(frontend)/robots.ts` are in [references/ai-crawlers.md](references/ai-crawlers.md). Re-read each vendor page linked there before shipping.

| Policy | Behavior |
| --- | --- |
| `allow-all` | No AI-specific group. `User-agent: *` disallows `/admin` |
| `allow-answer-block-training` | Search and user-triggered agents stay allowed. Training tokens are disallowed. `Google-Extended` also opts out of Gemini grounding, which the client must accept |
| `block-all` | Every verified AI token is disallowed. `Googlebot` and `Applebot` stay on the `*` rule, so Google Search and Apple search stay allowed |

Set `generateRobotsTxt: false` so `public/robots.txt` cannot override the CMS policy. A group that names a bot does not inherit the `*` group, so every group also disallows `/admin`.

`ChatGPT-User` and `Perplexity-User` may ignore robots.txt. Say that to the client. Do not promise those fetches will stop.

Until the client chooses, save `allow-all` and record that assumption in `PROJECT.md`.

## Step 6: llms.txt

Add `src/app/llms.txt/route.ts` with `export const dynamic = 'force-static'`. The format is the [llms.txt v2 spec](https://llmstxt.org/) (H1, blockquote, then H2 link lists). One H2 per locale, listing published pages, posts, services, and legal pages as `- [title](absolute URL): one line`. Titles come from the CMS.

Optional `src/app/llms-full.txt/route.ts` inlines plaintext of those bodies. Add it only after the client agrees, because it publishes full page text to anyone who fetches it.

In each of those collections' targets functions, append the literal paths `/llms.txt` and, when the full route exists, `/llms-full.txt`. Do not pass them through `localizedPaths`. That costs one or two ISR writes per publish.

In `next.config.ts`, rewrite `/llm.txt`, `/llms`, and `/llm` to `/llms.txt`. Leave `llms` and `llm` in the `src/proxy.ts` matcher.

## Step 7: Summarize with AI

`src/components/SummarizeWithAI.tsx` is the only file that knows assistant URLs. Spec and the click-test table: [references/summarize.md](references/summarize.md).

Mount it on pages, posts, and services. Leave it off legal pages. The footer shows a visible line linking to `/llms.txt`.

## Step 8: Answer-first content

Editors follow [references/aeo.md](references/aeo.md) on posts and services: a short answer under the title, question headings, a visible author and dates, `dateModified`, one name/address/phone, and real internal links.

## Step 9: Search Console

1. The client creates a domain property and pastes the token into `searchConsoleVerification`.
2. Submit `pages-sitemap.xml`, `posts-sitemap.xml`, and the legal and services sitemaps when those routes exist.
3. Ongoing Search Console data access is configured in `payload-integrations`.

## Environment

```bash
NEXT_PUBLIC_SERVER_URL=https://example.com
```

The website template already uses this variable. This skill requires it.

## Invalidation map

Add these rows to `PROJECT.md` in the cell form from the `payload-testing` skill. Keep a single `Locales: en, ar` line above the table. `layout` means the global tag only. Do not call `revalidatePath` with `'layout'`.

| Collection or global | Trigger | Paths | Tags | Writes per save |
| --- | --- | --- | --- | --- |
| site-settings | update | layout | `global_site-settings` | all routes x locales, rare, accepted |
| pages | publish | `/<locale>/<slug>`, `/llms.txt` | `pages:<slug>`, `pages-sitemap` | 2 + 1 = 3 |
| posts | publish | `/<locale>/posts/<slug>`, `/<locale>/posts`, `/llms.txt` | `posts:<slug>`, `collection:posts`, `posts-sitemap` | 4 + 1 = 5 |
| services | publish | `/<locale>/services/<slug>`, `/llms.txt` | `services:<slug>`, `services-sitemap` | 2 + 1 = 3 |
| legal-pages | publish | `/<locale>/legal/<slug>`, `/llms.txt` | `legal-pages:<slug>`, `legal-pages-sitemap` | 2 + 1 = 3 |

The trace fixtures are `trace-page`, `trace-post`, `trace-service`, and `trace-legal`, with no category and not featured on the home page, so the hook returns exactly these paths. A page whose slug is `home` regenerates `/<locale>` instead of `/<locale>/home`. Keep that branch in `publicPath`. Add `/llms-full.txt` beside `/llms.txt` only when that route exists. Category or home paths stay off these rows unless the fixture actually renders on those routes.

Detail queries keep `<collection>:<docSlug>` only. Listing queries keep `collection:<slug>` only. The hook log line is the check.

## Stop and ask

- `NEXT_PUBLIC_SERVER_URL` is missing, or the client has not confirmed the canonical host.
- The client has not chosen an AI crawler policy (leave `allow-all` only as a recorded assumption).
- They want LocalBusiness and the address, phone, or legal name is incomplete.
- The Arabic Open Graph region (`ar_EG`, `ar_SA`, `ar_AE`) is not in `PROJECT.md`.
- The Search Console token is not available yet. Ship metadata without the verification tag and add it when they paste it.
- They have not agreed to `/llms-full.txt`.
- An assistant URL failed the click test.

## Done when

- [ ] [Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/) accept the home page and a post
- [ ] View source on the home page shows one `application/ld+json` script whose `@graph` includes `WebSite` and `Organization`, using the site name from Site settings
- [ ] An admin, signed in, opens Settings then Site settings, changes the site name, logo, or a social URL, saves, and the next view-source shows that change. Sales cannot open the save action
- [ ] View source on a post shows `rel="canonical"`, one `hreflang` per locale, and `hreflang="x-default"`
- [ ] `curl.exe -s http://localhost:3000/llms.txt` prints markdown with one H2 per locale, and `/llm.txt`, `/llms`, and `/llm` return that same body with status 200
- [ ] `curl.exe -s http://localhost:3000/robots.txt` matches the chosen policy and disallows `/admin` in every group
- [ ] `curl.exe -s http://localhost:3000/pages-sitemap.xml` contains both `/en/` and `/ar/` URLs and `xhtml:link` alternates
- [ ] Publishing a post logs that post's paths plus `/llms.txt` (and `/llms-full.txt` when present). A site-settings save logs `global_site-settings` and does not call `revalidatePath` with `'layout'`

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Canonical host is localhost or `vercel.app` | `NEXT_PUBLIC_SERVER_URL` | Step 2 |
| JSON-LD name, logo, or `sameAs` is missing or still a placeholder | Site settings fields are empty, or the layout hardcoded the graph | Settings, Site settings. Rebuild from `organizationNode` and `websiteNode` |
| Open Graph image URL contains the site host plus `https://` | Absolute media URL was prefixed | Metadata reference, image helper |
| Sitemap lists only unprefixed paths | Template URLs were left in place | Step 4 |
| Admin policy does not change `/robots.txt` | `public/robots.txt` from next-sitemap | `generateRobotsTxt: false`, then delete that file |
| `/llms.txt` redirects to `/en/llms.txt` | Proxy matcher | Keep `llms` and `llm` excluded |
| A publish regenerates every route | Shared tag, or `revalidatePath` with `'layout'` | Targets reference |
