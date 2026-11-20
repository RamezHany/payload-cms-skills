# Cache-First Read Strategy & Instant On-Save Revalidation

Every frontend query MUST read from Next.js Data Cache (`unstable_cache` / `'use cache'`) indefinitely (`revalidate: false`). The database is ONLY queried on initial cache miss or immediately after an admin creates, updates, or deletes a document in Payload CMS.

## 1. Cached Query Helpers (`src/lib/cached-payload.ts`)

Use these helpers across all frontend Server Components so the database is never hit on normal visitor traffic:

```ts
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Fetches a single page by slug and locale from the cache.
 * Queries the database ONLY on the first visit or after `revalidateTag` is triggered by an admin edit.
 */
export const getCachedPage = (slug: string, locale: string = 'en') =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({
        collection: 'pages',
        where: {
          slug: { equals: slug },
        },
        locale: locale as any,
        depth: 2,
        limit: 1,
      })
      return result.docs[0] || null
    },
    [`page-${slug}-${locale}`],
    {
      tags: ['cms-content', 'collection:pages', `page:${slug}`, `locale:${locale}`],
      revalidate: false, // Indefinite cache until admin modifies content
    },
  )()

/**
 * Fetches any collection list from cache with tag-based invalidation.
 */
export const getCachedCollection = (
  collectionSlug: string,
  locale: string = 'en',
  limit: number = 100,
) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({
        collection: collectionSlug as any,
        locale: locale as any,
        depth: 2,
        limit,
      })
      return result.docs
    },
    [`collection-${collectionSlug}-${locale}-${limit}`],
    {
      tags: ['cms-content', `collection:${collectionSlug}`, `locale:${locale}`],
      revalidate: false,
    },
  )()

/**
 * Fetches a Global (e.g. header, footer, site-settings) from cache.
 */
export const getCachedGlobal = (globalSlug: string, locale: string = 'en') =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })
      return await payload.findGlobal({
        slug: globalSlug as any,
        locale: locale as any,
        depth: 2,
      })
    },
    [`global-${globalSlug}-${locale}`],
    {
      tags: ['cms-content', `global:${globalSlug}`, `locale:${locale}`],
      revalidate: false,
    },
  )()
```

## 2. Universal Revalidation Hooks (`src/hooks/revalidateCache.ts`)

Attach these hooks to all content collections and globals so that whenever an Admin saves or deletes content, the cache is invalidated immediately and the very next request populates fresh data from the database into the cache:

```ts
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

export const revalidateCollectionCache: CollectionAfterChangeHook = ({
  collection,
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  try {
    revalidateTag('cms-content')
    revalidateTag(`collection:${collection.slug}`)

    if (doc?.slug) {
      revalidateTag(`${collection.slug}:${doc.slug}`)
      revalidateTag(`page:${doc.slug}`)
      const path = doc.slug === 'home' ? '/' : `/${doc.slug}`
      revalidatePath(path, 'layout')
    }

    if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
      const oldPath = previousDoc.slug === 'home' ? '/' : `/${previousDoc.slug}`
      revalidatePath(oldPath, 'layout')
    }

    revalidatePath('/', 'layout')
    payload.logger.info(`[Cache Revalidated] Collection: ${collection.slug}`)
  } catch (err: any) {
    payload.logger.warn(`Revalidation skipped (non-Next context): ${err.message}`)
  }

  return doc
}

export const revalidateCollectionDelete: CollectionAfterDeleteHook = ({
  collection,
  doc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  try {
    revalidateTag('cms-content')
    revalidateTag(`collection:${collection.slug}`)
    if (doc?.slug) {
      revalidateTag(`page:${doc.slug}`)
    }
    revalidatePath('/', 'layout')
    payload.logger.info(`[Cache Revalidated on Delete] Collection: ${collection.slug}`)
  } catch (err: any) {
    payload.logger.warn(`Revalidation skipped (non-Next context): ${err.message}`)
  }

  return doc
}

export const revalidateGlobalCache: GlobalAfterChangeHook = ({
  global,
  doc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  try {
    revalidateTag('cms-content')
    revalidateTag(`global:${global.slug}`)
    revalidatePath('/', 'layout')
    payload.logger.info(`[Cache Revalidated] Global: ${global.slug}`)
  } catch (err: any) {
    payload.logger.warn(`Revalidation skipped (non-Next context): ${err.message}`)
  }

  return doc
}
```
