---
name: payload-performance
description: Speed for Payload CMS 3 + Next.js 16 sites on Vercel - static rendering with on-publish revalidation, two-argument revalidateTag, cached globals, lean Payload queries, function and database region pairing, small JavaScript and CSS bundles, lazy loading, fonts, third-party scripts, and Core Web Vitals targets. Use when pages are slow, caching is stale or too aggressive, bundles are large, or before launch.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload performance

Targets on a mid-range phone over 4G: LCP under 2.5 s, INP under 200 ms, CLS under 0.1.

## Step 1: Rendering and caching model

Use the template's model. Do not invent another.

| Data | How it is rendered | How it refreshes |
| --- | --- | --- |
| Pages, posts, legal pages, services | Static, prebuilt with `generateStaticParams` | `revalidatePath` in the collection's `afterChange` hook when published |
| Header, footer, site settings (globals) | `unstable_cache` with tag `global_<slug>` | `revalidateTag('global_<slug>', { expire: 0 })` in the global's `afterChange` hook |
| Sitemaps | Cached with tags `pages-sitemap`, `posts-sitemap` | `revalidateTag('<name>-sitemap', { expire: 0 })` on publish |
| Drafts (live preview) | Dynamic through draft mode | Never cached |
| User-specific data (booking slots, account) | Dynamic, fetched with TanStack Query from a route handler | Query `staleTime` |

Rules:

1. Next.js 16 requires two arguments: `revalidateTag(tag, profile)`. Payload hooks run in route handlers, so use `{ expire: 0 }` when editors expect to see changes on the next visit, or `'max'` when serving stale content once is acceptable. Never call the deprecated single-argument form.
2. Every revalidation hook checks `context.disableRevalidate` and skips drafts. Seed scripts and migrations set `context: { disableRevalidate: true }`, because `revalidatePath` throws outside a Next.js request.
3. Never wrap draft-mode queries in a cache (see `payload-live-preview`).
4. Do not enable `cacheComponents` in Payload 3 projects; the official templates do not use it.
5. Localized sites revalidate the path for each locale.

Global hook example (`src/globals/Header/hooks/revalidateHeader.ts`):

```ts
import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook } from 'payload'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info('Revalidating header')
    revalidateTag('global_header', { expire: 0 })
  }
  return doc
}
```

## Step 2: Lean Payload queries

1. Pass `select` with only the fields the component renders, and the lowest `depth` that works (usually 0 or 1).
2. Set `defaultPopulate` on collections that are often referenced (the template does this for pages and posts) so relationships return only `title` and `slug`.
3. Lists use `limit` and pagination. Use `pagination: false` only for small, bounded queries.
4. Add `index: true` to fields used in `where` and `sort` (`slug`, `_status`, `publishedAt`, `status`, `startsAt`).
5. Wrap per-request queries in React `cache()` so `generateMetadata` and the page share one query.

## Step 3: Pair function and database regions

Most latency on Vercel + Turso comes from the distance between the function and the database.

1. Create the Turso database in the region closest to the client's visitors.
2. Set the same region for Vercel functions in `vercel.json`: `{ "regions": ["fra1"] }` (use the matching Vercel region code).
3. Record both in `PROJECT.md`.

## Step 4: JavaScript

1. Server Components by default. `'use client'` goes on the smallest interactive leaf, not on layouts or sections.
2. Heavy client libraries (3D, maps, rich animation timelines, charts) load with `next/dynamic` inside a client component, and only when visible or on interaction.
3. Import specific modules, never whole libraries (`import { motion } from 'motion/react'`, not a full bundle).
4. One library per job: one animation library, one icon set, one date library.
5. Never ship the Payload Local API, `payload-types` runtime values, or server SDKs (`stripe`, `googleapis`) to the client. Server-only modules start with `import 'server-only'`.

## Step 5: CSS and fonts

1. Tailwind CSS only generates used classes. Do not import full CSS files from component or animation libraries; copy the few rules you need.
2. Load fonts with `next/font` (Google or local), with `subsets` limited to the scripts the site uses and `display: 'swap'`. At most two families.
3. Variable fonts over multiple static weights.

## Step 6: Images, video, and below-the-fold content

1. Follow `payload-media` for image loaders, `sizes`, and video facades.
2. Exactly one image per page gets `preload`: the LCP image.
3. Below-the-fold sections that need client code render a lightweight placeholder and hydrate on visibility.
4. Reserve space for every embed, image, and ad slot to avoid layout shift.

## Step 7: Third-party scripts

1. Analytics and tags load only after consent (`payload-legal-trust`) and through `next/script` with `strategy="afterInteractive"` or `"lazyOnload"`.
2. Prefer `@next/third-parties` for Google Analytics and Google Tag Manager.
3. No chat widgets or heatmaps on initial load; load them on interaction.

## Step 8: Measure

1. Run Lighthouse in Chrome DevTools (mobile, simulated throttling) on the home page, a post, and the booking page.
2. Check field data in Vercel Speed Insights (free tier) or PageSpeed Insights after launch.
3. Record the scores in `PROJECT.md`. Fix the largest regression first.

## Done when

- [ ] Publishing a post shows the change on the next visit; saving a draft does not revalidate anything
- [ ] No single-argument `revalidateTag` calls remain (search the codebase for `revalidateTag(`)
- [ ] Function region matches the Turso region
- [ ] Lighthouse mobile Performance is 90 or higher on the home page and a post page
- [ ] No server-only package appears in client bundles
