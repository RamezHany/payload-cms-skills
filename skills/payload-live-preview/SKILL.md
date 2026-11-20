---
name: payload-live-preview
description: Server-side live preview for Payload CMS 3 + Next.js App Router, matching the official website template - draft mode, autosave, preview route with secret and auth check, RefreshRouteOnSave listener, localized preview URLs, and cache bypass. Use when adding live preview or a preview button to any collection, when preview shows a blank iframe, published instead of draft content, the wrong language, or does not update while typing.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload live preview

Use the server-side pattern from the official website template. Client-only preview (`useLivePreview` merging data in the browser) breaks with Server Components, relationships, rich text, and locales, so do not use it.

## How it works

1. The admin opens an iframe at `/next/preview?path=/<locale>/posts/<slug>&previewSecret=...`.
2. The preview route checks the secret and the logged-in Payload user, enables Next.js draft mode, and redirects to the path.
3. The page sees draft mode, queries Payload with `draft: true`, and renders the latest draft.
4. `LivePreviewListener` (wrapping `RefreshRouteOnSave`) calls `router.refresh()` every time autosave writes a draft, so the iframe re-renders on the server.
5. When the editor switches locale in the admin, Payload recomputes the preview URL with the new locale, so the iframe follows the editing language.

## Step 1: Collection config

For each collection with a public page (`pages`, `posts`, `legal-pages`, `services`):

```ts
admin: {
  livePreview: {
    url: ({ data, locale }) =>
      generatePreviewPath({ collection: 'posts', slug: data?.slug, locale: locale?.code }),
  },
  preview: (data, { locale }) =>
    generatePreviewPath({ collection: 'posts', slug: data?.slug as string, locale }),
},
versions: {
  drafts: {
    autosave: { interval: 100 }, // required for live updates while typing
    schedulePublish: true,
  },
  maxPerDoc: 50,
},
```

Omit `locale` when the site is not localized. Read access must allow drafts for logged-in users and published docs for everyone (`authenticatedOrPublished` in the template).

## Step 2: Preview path helper

`src/utilities/generatePreviewPath.ts`:

```ts
import type { CollectionSlug, PayloadRequest } from 'payload'

const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  pages: '',
  posts: '/posts',
  'legal-pages': '/legal',
  services: '/services',
}

type Props = {
  collection: keyof typeof collectionPrefixMap
  slug: string | null | undefined
  locale?: string
  req?: PayloadRequest // accepted so the template's existing call sites keep compiling
}

export const generatePreviewPath = ({ collection, slug, locale }: Props): string | null => {
  if (slug === undefined || slug === null) return null

  const localePrefix = locale ? `/${locale}` : ''
  const isHome = collection === 'pages' && slug === 'home'
  const docPath = isHome ? '' : `${collectionPrefixMap[collection]}/${encodeURIComponent(slug)}`

  const params = new URLSearchParams({
    path: `${localePrefix}${docPath}` || '/',
    previewSecret: process.env.PREVIEW_SECRET || '',
  })

  return `/next/preview?${params.toString()}`
}
```

Keep the prefix map in sync with the frontend routes. A wrong prefix is the most common cause of a 404 inside the preview iframe.

## Step 3: Preview and exit routes

Keep the template's `src/app/(frontend)/next/preview/route.ts` unchanged. It must:

1. Return 403 when `previewSecret !== process.env.PREVIEW_SECRET`.
2. Reject paths that do not start with `/`.
3. Call `payload.auth({ req, headers: req.headers })` and return 403 when there is no user.
4. Call `(await draftMode()).enable()` and `redirect(path)`.

If the project does not have it (Payload added to an existing app), copy `preview/route.ts` and `exit-preview/route.ts` from `templates/website/src/app/(frontend)/next/` on the `3.x` branch.

## Step 4: The page

Every previewable page follows this shape. Full localized example: [references/localized-page.md](references/localized-page.md).

```tsx
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { LivePreviewListener } from '@/components/LivePreviewListener'
import { getPayloadClient } from '@/lib/payload'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { isEnabled: draft } = await draftMode()
  const post = await queryPostBySlug(decodeURIComponent(slug))
  if (!post) return notFound()

  return (
    <article>
      {draft && <LivePreviewListener />}
      {/* render post */}
    </article>
  )
}

const queryPostBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'posts',
    draft,
    overrideAccess: draft,
    limit: 1,
    pagination: false,
    where: { slug: { equals: slug } },
  })
  return result.docs[0] ?? null
})
```

Rules:

1. Read `draftMode()` inside the query function and pass `draft` to `payload.find`.
2. Never wrap draft queries in `unstable_cache` or `'use cache'`. Draft mode already makes the route dynamic; a cache layer would serve stale or published content.
3. Pass `locale` to `payload.find` on localized sites.
4. Fetch relationships at a `depth` that the page needs, so the preview matches production.

## Step 5: The listener

`src/components/LivePreviewListener.tsx` (from the template):

```tsx
'use client'

import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'

import { getClientSideURL } from '@/utilities/getURL'

export function LivePreviewListener() {
  const router = useRouter()
  return <PayloadLivePreview refresh={router.refresh} serverURL={getClientSideURL()} />
}
```

`getClientSideURL` must return `window.location.origin` in the browser. A hardcoded production URL breaks preview on preview deployments and localhost.

## Step 6: Revalidate only on publish

Autosave writes a draft every 100 ms of typing, and live preview reads drafts dynamically, so drafts never need revalidation. Every revalidation on Vercel is a metered ISR write, so the hooks must be exact:

1. Revalidate only when a document is published, unpublished, renamed, or deleted. Draft-only saves revalidate nothing.
2. Revalidate exactly the routes that render the document: its detail path for each locale, the listings that show it, and the home page only if it is featured there. Never revalidate the layout and never expire a tag shared by all content.
3. Use the `revalidateOnPublish` hook factory and a per-collection targets function from the `payload-performance` skill. A worked example for localized posts is in [references/localized-page.md](references/localized-page.md).

## Step 7: Headers and hosting

1. If `next.config.ts` sets `X-Frame-Options: DENY` or a CSP `frame-ancestors 'none'`, change it to `frame-ancestors 'self'`. The admin and frontend share one origin, so `'self'` is enough.
2. Vercel Deployment Protection blocks the iframe on protected preview deployments. Test live preview on production or on an unprotected deployment.
3. `PREVIEW_SECRET` must be set in every environment.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Blank iframe, console shows "refused to frame" | `X-Frame-Options` or CSP | Step 7.1 |
| "You are not allowed to preview this page" | Missing `PREVIEW_SECRET`, or not logged in on this origin | Set the env var; log in to `/admin` on the same domain |
| 404 inside the iframe | Prefix map or locale prefix does not match routes | Fix `collectionPrefixMap` and the locale segment |
| Shows published content | Query lacks `draft`, or a cache wraps the query | Step 4 rules 1 and 2 |
| Does not update while typing | No autosave, no listener, or listener `serverURL` mismatch | Step 1 autosave; render `LivePreviewListener` when `draft`; Step 5 |
| Wrong language | `url` ignores `locale`, or the page does not pass `locale` to `find` | Steps 1, 2, 4 |
| Works locally, not on Vercel | Deployment Protection, missing env var | Step 7 |

## Done when

- [ ] Every previewable collection has `livePreview.url`, `preview`, and autosave drafts
- [ ] Typing in a field updates the iframe within about a second, without a manual save
- [ ] Switching locale in the admin switches the iframe to the same locale
- [ ] The published page does not show unpublished draft changes
- [ ] Typing in the admin produces no `revalidate` log lines; publishing produces one line listing only that document's routes
- [ ] The live preview test in the `payload-testing` skill passes
