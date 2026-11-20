---
name: payload-performance
description: Speed and cache cost for Payload CMS 3 + Next.js 16 sites on Vercel - static rendering, precise on-publish invalidation designed as a metered cost (no shared tags, no layout-wide revalidation, per-document targets, invalidation map), two-argument revalidateTag, lean Payload queries, function and database region pairing, small bundles, lazy loading, fonts, third-party scripts, and Core Web Vitals. Use when writing any revalidation hook or cache tag, when ISR writes or usage are high, pages are slow or stale, bundles are large, or before launch.
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
| Pages, posts, legal pages, services | Static, prebuilt with `generateStaticParams` | Exact paths from the collection's targets function, on publish |
| Listings (posts index, category pages, home sections) | Static | Listed explicitly in the targets of the documents they render |
| Header, footer, site settings (layout-rendered globals) | `unstable_cache` with tag `global_<slug>` | That global's own `afterChange` hook only |
| Sitemaps | Cached with tag `<collection>-sitemap` | Targets of that collection, on publish |
| Drafts (live preview) | Dynamic through draft mode | Never cached |
| User-specific data (booking slots, account) | Dynamic, fetched with TanStack Query from a route handler | Query `staleTime` |

General rules:

1. Next.js 16 requires two arguments: `revalidateTag(tag, profile)`. Payload hooks run in route handlers, so use `{ expire: 0 }` when editors expect to see changes on the next visit. Never call the deprecated single-argument form.
2. Every revalidation hook checks `context.disableRevalidate` and skips draft-only changes. Seed scripts and migrations set `context: { disableRevalidate: true }`, because `revalidatePath` throws outside a Next.js request.
3. Never wrap draft-mode queries in a cache (see `payload-live-preview`).
4. Do not enable `cacheComponents` in Payload 3 projects; the official templates do not use it.

## Step 2: Design invalidation as a cost

Every revalidated path regenerates on its next visit, and each regeneration is a metered ISR write on Vercel. Hobby has a fixed monthly ISR write allowance (200K at the time of a 2026-11 production audit). When it runs out, pages stop regenerating until the billing cycle resets: the site stays up, but content silently freezes. In that audit, a low-traffic bilingual site used 72% of the allowance (about 4,800 writes per day) because of two patterns this step forbids.

Rules:

1. **No shared cache tags on content queries.** Detail queries carry only `<collection>:<docSlug>`. Listing queries carry only `collection:<slug>`. Never put the collection tag on detail queries, and never put one tag (such as `cms-content`) on every query. A tag may be global only when the data renders in the layout (`global_header`), and it is invalidated only when that global changes.
2. **Compute invalidation from the change.** Revalidate the collection, the document's own tag, and the routes that actually render the document: its detail page, the listings that show it, and the home page only if the document is featured there. Nothing else.
3. **`revalidatePath(path, 'layout')` is forbidden** except in hooks for layout-rendered globals, and every use carries a comment naming the layout data that justifies it. Prefer the global tag even then.
4. **Never pair `revalidate: false` caches with broad invalidation.** When pages depend entirely on tags, tag precision is the cost model.
5. **Media and other supporting collections revalidate narrowly.** A new upload revalidates nothing, because nothing references it yet. An edit to an existing file revalidates only the published documents that reference it.
6. **Batch operations revalidate once.** Imports, seeding, bulk issuance, and scripts pass `context: { disableRevalidate: true }` on every Local API call, then apply one combined set of targets at the end.
7. **No timers on pages covered by targets.** The template's posts index and its pagination pages export `revalidate = 600`, so each one can regenerate every 10 minutes per locale while it gets traffic, even when nothing changed. Once a page is listed in a collection's targets, remove its time-based `revalidate` export and keep `dynamic = 'force-static'`.
8. **Broader invalidation must state its reason and cost.** If you deliberately invalidate more than the change requires, the code comment says why and how many writes each save causes.

Implementation (targets helper, per-collection targets, media hook, global hook, batch pattern): [references/invalidation-design.md](references/invalidation-design.md).

Before delivery, fill in the invalidation map in `PROJECT.md`: one row per collection and global, listing which routes regenerate on a save and the write cost (paths × locales). If any ordinary content type regenerates every route, the design fails review.

## Step 3: Lean Payload queries

1. Pass `select` with only the fields the component renders, and the lowest `depth` that works (usually 0 or 1).
2. Set `defaultPopulate` on collections that are often referenced (the template does this for pages and posts) so relationships return only `title` and `slug`.
3. Lists use `limit` and pagination. Use `pagination: false` only for small, bounded queries.
4. Add `index: true` to fields used in `where` and `sort` (`slug`, `_status`, `publishedAt`, `status`, `startsAt`).
5. Wrap per-request queries in React `cache()` so `generateMetadata` and the page share one query.

## Step 4: Pair function and database regions

Most latency on Vercel + Turso comes from the distance between the function and the database.

1. Create the Turso database in the region closest to the client's visitors.
2. Set the same region for Vercel functions in `vercel.json`: `{ "regions": ["fra1"] }` (use the matching Vercel region code).
3. Record both in `PROJECT.md`.

## Step 5: JavaScript

1. Server Components by default. `'use client'` goes on the smallest interactive leaf, not on layouts or sections.
2. Heavy client libraries (3D, maps, rich animation timelines, charts) load with `next/dynamic` inside a client component, and only when visible or on interaction.
3. Import specific modules, never whole libraries (`import { motion } from 'motion/react'`, not a full bundle).
4. One library per job: one animation library, one icon set, one date library.
5. Never ship the Payload Local API, `payload-types` runtime values, or server SDKs (`stripe`, `googleapis`) to the client. Server-only modules start with `import 'server-only'`.

## Step 6: CSS and fonts

1. Tailwind CSS only generates used classes. Do not import full CSS files from component or animation libraries; copy the few rules you need.
2. Load fonts with `next/font` (Google or local), with `subsets` limited to the scripts the site uses and `display: 'swap'`. At most two families.
3. Variable fonts over multiple static weights.

## Step 7: Images, video, and below-the-fold content

1. Follow `payload-media` for image loaders, `sizes`, and video facades.
2. Exactly one image per page gets `preload`: the LCP image.
3. Below-the-fold sections that need client code render a lightweight placeholder and hydrate on visibility.
4. Reserve space for every embed, image, and ad slot to avoid layout shift.

## Step 8: Third-party scripts

1. Analytics and tags load only after consent (`payload-legal-trust`) and through `next/script` with `strategy="afterInteractive"` or `"lazyOnload"`.
2. Prefer `@next/third-parties` for Google Analytics and Google Tag Manager.
3. No chat widgets or heatmaps on initial load; load them on interaction.

## Step 9: Measure

1. Run Lighthouse in Chrome DevTools (mobile, simulated throttling) on the home page, a post, and the booking page.
2. Check field data in Vercel Speed Insights (free tier) or PageSpeed Insights after launch.
3. After launch, check ISR Writes on the Vercel Usage page weekly for the first month. Compare against the invalidation map: writes per day should be close to (saves per day × writes per save) plus first visits after deploys.
4. Record the scores and the ISR baseline in `PROJECT.md`. Fix the largest regression first.

## Done when

- [ ] Publishing a post shows the change on the next visit; saving a draft does not revalidate anything
- [ ] Invalidation map in `PROJECT.md` lists every collection and global; no ordinary content type regenerates every route
- [ ] For each collection, one traced save regenerates exactly the routes in its map row (verified with the hook's log line)
- [ ] Uploading a new media file revalidates nothing
- [ ] No tag is shared by all content queries; detail queries do not carry the collection tag
- [ ] Every `revalidatePath(..., 'layout')` call is in a layout-global hook and has a justifying comment (search for `'layout')`)
- [ ] No page covered by a targets function exports a time-based `revalidate` (search for `export const revalidate`)
- [ ] No single-argument `revalidateTag` calls remain (search the codebase for `revalidateTag(`)
- [ ] Function region matches the Turso region
- [ ] Lighthouse mobile Performance is 90 or higher on the home page and a post page
- [ ] No server-only package appears in client bundles
