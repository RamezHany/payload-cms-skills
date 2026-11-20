# Localized previewable page

`src/app/(frontend)/[locale]/posts/[slug]/page.tsx` for a site using next-intl routing (set up by the `payload-localization` skill).

```tsx
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import type { TypedLocale } from 'payload'
import { cache } from 'react'

import { LivePreviewListener } from '@/components/LivePreviewListener'
import RichText from '@/components/RichText'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'
import { generateMeta } from '@/utilities/generateMeta'

type Args = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  const payload = await getPayloadClient()
  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: { slug: true },
  })

  return routing.locales.flatMap((locale) =>
    posts.docs.filter((doc) => doc.slug).map((doc) => ({ locale, slug: doc.slug as string })),
  )
}

export default async function PostPage({ params }: Args) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const { isEnabled: draft } = await draftMode()
  const post = await queryPostBySlug({ slug: decodeURIComponent(slug), locale })
  if (!post) notFound()

  return (
    <article>
      {draft && <LivePreviewListener />}
      <h1>{post.title}</h1>
      {post.content && <RichText data={post.content} />}
    </article>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const post = await queryPostBySlug({ slug: decodeURIComponent(slug), locale })
  return generateMeta({ doc: post })
}

const queryPostBySlug = cache(async ({ slug, locale }: { slug: string; locale: TypedLocale }) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'posts',
    draft,
    locale,
    overrideAccess: draft,
    depth: 1,
    limit: 1,
    pagination: false,
    where: { slug: { equals: slug } },
  })

  return result.docs[0] ?? null
})
```

## Notes

- `hasLocale` narrows the string to a configured next-intl locale. It is assignable to Payload's `TypedLocale` because both use the same codes (enforced in `payload-localization`). If TypeScript reports a mismatch, the two locale lists have drifted; fix the lists, do not cast.
- `generateStaticParams` prebuilds published posts for every locale. Draft mode renders dynamically, so drafts never enter the static cache.
- `RichText` and `generateMeta` come from the website template. Copy them from `templates/website/src` on the `3.x` branch if the project does not have them.
- The revalidation hook for posts must revalidate `/${locale}/posts/${slug}` for every locale when a post is published.

## Revalidation hook for localized posts

`src/collections/Posts/hooks/revalidatePost.ts`:

```ts
import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { routing } from '@/i18n/routing'
import type { Post } from '@/payload-types'

const pathsFor = (slug: string) => routing.locales.map((locale) => `/${locale}/posts/${slug}`)

export const revalidatePost: CollectionAfterChangeHook<Post> = ({ doc, previousDoc, req: { payload, context } }) => {
  if (context.disableRevalidate) return doc

  if (doc._status === 'published' && doc.slug) {
    for (const path of pathsFor(doc.slug)) revalidatePath(path)
    revalidateTag('posts-sitemap', { expire: 0 })
    payload.logger.info(`Revalidated post ${doc.slug}`)
  }

  if (previousDoc?._status === 'published' && previousDoc.slug && (doc._status !== 'published' || previousDoc.slug !== doc.slug)) {
    for (const path of pathsFor(previousDoc.slug)) revalidatePath(path)
    revalidateTag('posts-sitemap', { expire: 0 })
  }

  return doc
}

export const revalidatePostDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate && doc?.slug) {
    for (const path of pathsFor(doc.slug)) revalidatePath(path)
    revalidateTag('posts-sitemap', { expire: 0 })
  }
  return doc
}
```
