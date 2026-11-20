# Invalidation design

Invalidation breadth is a cost decision. On Vercel, every path you revalidate regenerates on its next visit and counts as an ISR write; Hobby has a fixed monthly allowance, and when it is exhausted content silently stops updating. Design invalidation like a budget: the smallest set of paths and tags that is provably correct.

## Anti-patterns from a production audit

Both patterns below shipped in a generated project and consumed 72% of the Hobby ISR write allowance on a low-traffic bilingual site. Recognize them and never write them.

Never: one shared tag on every content query, expired on every save.

```ts
// NEVER
unstable_cache(fetchFn, keyParts, { tags: ['cms-content', 'collection:partners'], revalidate: false })

// in a hook shared by all collections:
revalidateTag('cms-content', { expire: 0 }) // expires every cached query on the site
```

Never: layout-wide revalidation as a default for ordinary content.

```ts
// NEVER: for a media or document save
revalidatePath('/', 'layout')
revalidatePath('/en', 'layout') // regenerates every route under the layout
```

Both come from adding invalidation "to be safe". The precise tags and paths were already available; the broad ones only added cost.

## Tag taxonomy

| Tag | Carried by | Expired when |
| --- | --- | --- |
| `<collection>:<docSlug>` (for example `posts:hello-world`) | Detail queries for that document | That document is published, unpublished, renamed, or deleted |
| `collection:<collection>` | Listing queries (indexes, category pages, home sections) | Any published document in that collection changes in a way listings show |
| `global_<slug>` (template name) | The global's cached read (header, footer, site settings) | That global changes |
| `<collection>-sitemap` (template name) | The sitemap route for that collection | A document in that collection is published, unpublished, renamed, or deleted |

Rules:

1. A query carries only the tags of the data it returns. Detail queries never carry `collection:<collection>`.
2. No tag is shared by all queries. There is no `cms-content`, `all`, or `site` tag.
3. Pages that the template renders statically with React `cache()` (no data cache) are invalidated by path, not by tag.

Tagging cached reads:

```ts
import { unstable_cache } from 'next/cache'

import { collectionTag, docTag } from '@/utilities/revalidation'

export const getPostBySlug = (slug: string, locale: AppLocale) =>
  unstable_cache(() => queryPostBySlug(slug, locale), ['post', locale, slug], {
    tags: [docTag('posts', slug)],
  })()

export const getRecentPosts = (locale: AppLocale) =>
  unstable_cache(() => queryRecentPosts(locale), ['posts-recent', locale], {
    tags: [collectionTag('posts')],
  })()
```

## Shared helper

`src/utilities/revalidation.ts`:

```ts
import 'server-only'

import { revalidatePath, revalidateTag } from 'next/cache'
import type { Payload } from 'payload'

import { locales } from '@/i18n/locales'

export type RevalidationTargets = {
  reason: string
  paths: string[]
  tags: string[]
}

export const noTargets: RevalidationTargets = { reason: '', paths: [], tags: [] }

export const docTag = (collection: string, slug: string) => `${collection}:${slug}`
export const collectionTag = (collection: string) => `collection:${collection}`
export const globalTag = (slug: string) => `global_${slug}`
export const sitemapTag = (collection: string) => `${collection}-sitemap`

// For a site without locales, return [path].
export const localizedPaths = (path: string): string[] =>
  locales.map((locale) => (path === '/' ? `/${locale}` : `/${locale}${path}`))

export function mergeTargets(...targets: RevalidationTargets[]): RevalidationTargets {
  return {
    reason: targets.map((target) => target.reason).filter(Boolean).join('; '),
    paths: [...new Set(targets.flatMap((target) => target.paths))],
    tags: [...new Set(targets.flatMap((target) => target.tags))],
  }
}

export function applyRevalidation(targets: RevalidationTargets, payload: Payload): void {
  if (!targets.paths.length && !targets.tags.length) return
  for (const path of targets.paths) revalidatePath(path)
  for (const tag of targets.tags) revalidateTag(tag, { expire: 0 })
  payload.logger.info(
    `revalidate (${targets.reason}): ${targets.paths.length} paths [${targets.paths.join(', ')}] tags [${targets.tags.join(', ')}]`,
  )
}
```

The log line is how you trace a save during review.

## Per-collection targets

Each collection with public routes has one targets function next to its hooks. It lists the routes that render the document and nothing else.

`src/collections/Posts/hooks/postTargets.ts`:

```ts
import type { PayloadRequest } from 'payload'

import type { Post } from '@/payload-types'
import {
  collectionTag,
  docTag,
  localizedPaths,
  noTargets,
  sitemapTag,
  type RevalidationTargets,
} from '@/utilities/revalidation'

type PostRef = Pick<Post, 'slug' | 'categories' | 'featuredOnHome'>

export async function postTargets(post: PostRef, req: PayloadRequest): Promise<RevalidationTargets> {
  if (!post.slug) return noTargets

  const categoryIds = (post.categories ?? []).map((category) =>
    typeof category === 'object' ? category.id : category,
  )
  const categories = categoryIds.length
    ? await req.payload.find({
        collection: 'categories',
        where: { id: { in: categoryIds } },
        select: { slug: true },
        depth: 0,
        limit: categoryIds.length,
        pagination: false,
        req,
      })
    : { docs: [] }

  return {
    reason: `posts:${post.slug}`,
    paths: [
      ...localizedPaths(`/posts/${post.slug}`),
      ...localizedPaths('/posts'),
      ...categories.docs.flatMap((category) =>
        category.slug ? localizedPaths(`/posts/category/${category.slug}`) : [],
      ),
      ...(post.featuredOnHome ? localizedPaths('/') : []),
    ],
    tags: [docTag('posts', post.slug), collectionTag('posts'), sitemapTag('posts')],
  }
}
```

Adapt the paths to the site's real routes. If the index is paginated (`/posts/page/<n>` in the template), a publish shifts every page: add `/posts/page/2` through the last page, computed from one `req.payload.count` query of published posts and the page size. `featuredOnHome` stands for whatever decides whether the home page renders the post. If the home page shows the latest N posts instead, include `/` only when the post is among the latest N published (one query with `sort: '-publishedAt'`, `limit: N`, `select: { id: true }`).

## Hook factory for publishable collections

The website template ships `revalidatePage` and `revalidatePost` hooks. They are narrow, but they miss listings and treat the first autosave of an editing session as an unpublish. Replace them with this factory and a targets function per collection; the tag names stay compatible with the template's sitemap routes.

`src/hooks/revalidateOnPublish.ts`:

```ts
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionSlug,
  PayloadRequest,
  TypeWithID,
} from 'payload'

import { applyRevalidation, mergeTargets, noTargets, type RevalidationTargets } from '@/utilities/revalidation'

type Publishable = TypeWithID & { _status?: 'draft' | 'published' | null; slug?: string | null }
type TargetsFn<T> = (doc: T, req: PayloadRequest) => Promise<RevalidationTargets> | RevalidationTargets

export function revalidateOnPublish<T extends Publishable>(
  collection: CollectionSlug,
  targetsFor: TargetsFn<T>,
): CollectionAfterChangeHook<T> {
  return async ({ doc, previousDoc, req }) => {
    if (req.context.disableRevalidate) return doc

    const isPublished = doc._status === 'published'
    const publishedPrevious = previousDoc?._status === 'published' ? previousDoc : undefined
    let leftOldRoutes = Boolean(publishedPrevious && publishedPrevious.slug !== doc.slug)

    if (publishedPrevious && !isPublished) {
      // Verified against Payload 3.94 update.ts: a draft save (draft: true) does not
      // touch the main row, but afterChange still runs, and on the first autosave of a
      // published document previousDoc is that published version. Only an unpublish
      // (draft: false, _status: 'draft') changes the main row. Read it to tell them apart.
      const live = await req.payload.findByID({
        collection,
        id: doc.id,
        draft: false,
        depth: 0,
        select: { _status: true },
        req,
      })
      leftOldRoutes = live._status !== 'published'
    }

    const targets = mergeTargets(
      isPublished ? await targetsFor(doc, req) : noTargets,
      leftOldRoutes && publishedPrevious ? await targetsFor(publishedPrevious, req) : noTargets,
    )
    applyRevalidation(targets, req.payload)
    return doc
  }
}

export function revalidateOnDelete<T extends Publishable>(targetsFor: TargetsFn<T>): CollectionAfterDeleteHook<T> {
  return async ({ doc, req }) => {
    if (req.context.disableRevalidate || doc._status !== 'published') return doc
    applyRevalidation(await targetsFor(doc, req), req.payload)
    return doc
  }
}
```

Wiring (pass the generated type explicitly so the targets function's narrower parameter type is accepted):

```ts
hooks: {
  afterChange: [revalidateOnPublish<Post>('posts', postTargets)],
  afterDelete: [revalidateOnDelete<Post>(postTargets)],
},
```

Draft-only edits (autosave while typing in live preview) revalidate nothing.

## Media and other supporting collections

A new upload is referenced by nothing, so it revalidates nothing. An edit to an existing file (alt text, focal point, replaced file) revalidates only the published documents that reference it through known fields.

`src/collections/Media/hooks/revalidateMediaReferences.ts`:

```ts
import type { CollectionAfterChangeHook } from 'payload'

import { postTargets } from '@/collections/Posts/hooks/postTargets'
import type { Media } from '@/payload-types'
import { applyRevalidation, mergeTargets } from '@/utilities/revalidation'

const MAX_REFERENCES = 20

export const revalidateMediaReferences: CollectionAfterChangeHook<Media> = async ({ doc, operation, req }) => {
  if (operation === 'create' || req.context.disableRevalidate) return doc

  const posts = await req.payload.find({
    collection: 'posts',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { or: [{ heroImage: { equals: doc.id } }, { 'meta.image': { equals: doc.id } }] },
      ],
    },
    select: { slug: true, categories: true, featuredOnHome: true },
    depth: 0,
    limit: MAX_REFERENCES,
    pagination: false,
    req,
  })

  if (posts.docs.length === MAX_REFERENCES) {
    req.payload.logger.warn(`media ${doc.id}: more than ${MAX_REFERENCES} referencing posts; only the first ${MAX_REFERENCES} were revalidated`)
  }

  const targets = mergeTargets(...(await Promise.all(posts.docs.map((post) => postTargets(post, req)))))
  applyRevalidation(targets, req.payload)
  return doc
}
```

Add one query per collection and field that references media. References inside blocks or rich text are not queried; those pages pick up the change on their next publish. Record that limitation in the invalidation map.

## Layout-rendered globals

A global that renders in the layout (header, footer, site settings) legitimately regenerates every page when it changes. These edits are rare, so the cost is acceptable, but the code must say so.

`src/globals/Header/hooks/revalidateHeader.ts`:

```ts
import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook } from 'payload'

import { globalTag } from '@/utilities/revalidation'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc
  // The header renders in the root layout on every route: one edit regenerates all routes x locales.
  revalidateTag(globalTag('header'), { expire: 0 })
  req.payload.logger.info('revalidate (global_header): all routes that render the header')
  return doc
}
```

The global tag is enough: every page that read the tagged global regenerates. `revalidatePath(path, 'layout')` is not needed here; if you use it anyway, it needs the same justifying comment.

Globals that render on one page only (for example `booking-settings` on `/book`) revalidate that page's paths, not the layout.

## Batch operations

Imports, seeding, and bulk issuance (for example generating 200 certificates) must not run a full revalidation per document.

```ts
const targets: RevalidationTargets[] = []

for (const item of items) {
  const doc = await payload.create({
    collection: 'certificates',
    data: item,
    context: { disableRevalidate: true },
    req,
  })
  targets.push(await certificateTargets(doc, req))
}

applyRevalidation(mergeTargets(...targets), payload)
```

Run batch work inside a Payload endpoint or route handler so the final `applyRevalidation` executes in a Next.js request. Standalone scripts outside Next.js skip revalidation entirely; the next deploy or the next publish refreshes the affected pages.

## Invalidation map

Add this table to `PROJECT.md` and keep it current. Writes per save is the number of paths revalidated (each regenerates once on its next visit), counted across locales.

```markdown
## Invalidation map

Locales: 2

| Collection or global | Trigger | Paths (per locale) | Tags | Writes per save |
| --- | --- | --- | --- | --- |
| posts | publish, unpublish, rename, delete | /posts/<slug>, /posts, /posts/category/<c> (1-3), / if featured | posts:<slug>, collection:posts, posts-sitemap | (2 + categories + home?) x 2 = 6-10 |
| pages | publish, unpublish, rename, delete | /<slug> (or / for home) | pages:<slug>, pages-sitemap | 1 x 2 = 2 |
| legal-pages | publish, unpublish, rename, delete | /legal/<slug> | legal-pages:<slug> | 1 x 2 = 2 |
| media | create | none | none | 0 |
| media | update | published posts referencing it (heroImage, meta.image) | via post targets | refs x 6-10 |
| leads, bookings, payment-events | any | none (not public) | none | 0 |
| header, footer | update | all routes (layout) | global_header / global_footer | all routes x 2 (rare, accepted) |
| booking-settings | update | /book | none | 1 x 2 = 2 |
```

Review rule: if any ordinary content type (anything other than layout-rendered globals) shows "all routes", the design fails.

## Tracing a save

For each row of the map:

1. Run `pnpm dev`, open the admin, and save one document of that collection (publish, then edit and publish again).
2. Read the `revalidate (...)` log line in the server output.
3. The listed paths and tags must equal the map row. Extra paths are a defect even if the site still works.
4. Save a draft without publishing: there must be no `revalidate` line.
5. Upload a new media file: there must be no `revalidate` line.

## After launch

Check ISR Writes on the Vercel Usage page weekly for the first month and compare against the map: expected daily writes are roughly (publishes per day x writes per save) plus first visits after each deploy. A large gap means a hook revalidates more than its map row says.
