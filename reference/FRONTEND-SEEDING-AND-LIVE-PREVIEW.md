# Frontend Decomposition, Exact Content Seeding, Dynamic Blocks & Live Preview

When provided with an existing frontend design (Next.js components/pages with hardcoded text, images, and sections), follow this exact workflow so the website renders 100% identically from the database while becoming fully editable and reorderable in Payload CMS.

## 1. Decomposing the Frontend into Payload Blocks

1. **Inspect the Frontend Page Order**: Read every section in the target page (e.g., `Hero`, `Features`, `About`, `Testimonials`, `FAQ`, `ContactForm`) in its exact visual top-to-bottom sequence.
2. **Create Matching Block Configs**: For each section, create a native Payload `Block` definition in `src/blocks/<SectionName>Block.ts` using native Payload fields (`text`, `textarea`, `richText`, `upload`, `array`, `select`, `checkbox`, `slugField()`).
3. **Enable Localization When Multi-Language**: If the site has more than one language, add `localized: true` on all translatable fields (`text`, `textarea`, `richText`, `array`, or the top-level `layout` `blocks` field) so the editor can edit English, click Save, switch the locale selector in the Admin header, and edit the other language version.
4. **Dynamic Reordering via `blocks` Field**: In `src/collections/Pages.ts`, define a `layout` field of `type: 'blocks'` containing all section blocks. This allows the admin to drag-and-drop sections to change their order on the page at any time.

```ts
// src/collections/Pages.ts
import { type CollectionConfig, slugField } from 'payload'
import { withHiddenAPI } from '@/lib/withHiddenAPI'
import {
  revalidateCollectionCache,
  revalidateCollectionDelete,
} from '@/hooks/revalidateCache'
import { HeroBlock } from '@/blocks/HeroBlock'
import { FeaturesBlock } from '@/blocks/FeaturesBlock'
import { ContactFormBlock } from '@/blocks/ContactFormBlock'

export const Pages: CollectionConfig = withHiddenAPI({
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, locale }) => {
        const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const slug = data?.slug === 'home' ? '' : data?.slug || ''
        const locPrefix = locale?.code ? `/${locale.code}` : ''
        return `${base}${locPrefix}/${slug}?preview=true`
      },
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [revalidateCollectionCache],
    afterDelete: [revalidateCollectionDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    slugField({
      name: 'slug',
      useAsSlug: 'title',
      required: true,
    }),
    {
      name: 'layout',
      type: 'blocks',
      required: true,
      localized: true,
      labels: {
        singular: 'Page Section',
        plural: 'Page Sections',
      },
      blocks: [HeroBlock, FeaturesBlock, ContactFormBlock],
    },
  ],
})
```

## 2. Zero-Loss Content Extraction & Seeding (`src/seed/seedInitialContent.ts`)

**CRITICAL RULE**: Never replace the client's existing frontend text, images, or section order with placeholder text (`Lorem ipsum`) or altered copy.

1. Extract every single heading, paragraph, button label, list item, and image path verbatim from the existing frontend components.
2. Upload local static assets into the `media` collection (or reference their URLs) during seeding.
3. Seed the `pages` and `globals` documents in the exact original section order inside `onInit` (when the `pages` collection is empty):

```ts
// src/seed/seedInitialContent.ts
import type { Payload } from 'payload'

export async function seedInitialContent(payload: Payload) {
  const existingPages = await payload.find({
    collection: 'pages',
    limit: 1,
  })

  if (existingPages.totalDocs > 0) {
    return // Already seeded; never overwrite admin edits
  }

  // Seed exact frontend content in original section order
  await payload.create({
    collection: 'pages',
    context: { disableRevalidate: true },
    data: {
      title: 'Home',
      slug: 'home',
      layout: [
        {
          blockType: 'hero',
          heading: 'Exact Original Hero Heading from Frontend',
          subheading: 'Exact Original Subheading from Frontend',
          ctaLabel: 'Get Started',
          ctaUrl: '/contact',
        },
        {
          blockType: 'features',
          sectionTitle: 'Exact Original Features Heading',
          items: [
            { title: 'Feature 1', description: 'Exact Feature 1 copy' },
            { title: 'Feature 2', description: 'Exact Feature 2 copy' },
          ],
        },
      ],
    },
  })

  payload.logger.info('Seeded initial frontend content into Payload database.')
}
```

## 3. Real-Time Live Preview on the Frontend

Install `@payloadcms/live-preview-react` and create a Client Wrapper so that when an admin edits a page in Payload's Live Preview, they immediately see their changes in real time while regular visitors receive the cached Server Component output.

```tsx
// src/components/frontend/PageLivePreview.tsx
'use client'
import React from 'react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import { RenderBlocks } from './RenderBlocks'

export const PageLivePreview: React.FC<{ initialPage: any }> = ({ initialPage }) => {
  const { data } = useLivePreview({
    initialData: initialPage,
    serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    depth: 2,
  })

  return <RenderBlocks layout={data?.layout || []} />
}
```

```tsx
// src/components/frontend/RenderBlocks.tsx
import React from 'react'
import { HeroSection } from './sections/HeroSection'
import { FeaturesSection } from './sections/FeaturesSection'
import { ContactFormSection } from './sections/ContactFormSection'

const blockComponents: Record<string, React.FC<any>> = {
  hero: HeroSection,
  features: FeaturesSection,
  contactForm: ContactFormSection,
}

export const RenderBlocks: React.FC<{ layout: any[] }> = ({ layout }) => {
  if (!Array.isArray(layout)) return null

  return (
    <>
      {layout.map((block, index) => {
        const Component = blockComponents[block.blockType]
        if (!Component) return null
        return <Component key={block.id || index} {...block} />
      })}
    </>
  )
}
```

```tsx
// src/app/(frontend)/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getCachedPage } from '@/lib/cached-payload'
import { PageLivePreview } from '@/components/frontend/PageLivePreview'

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ slug?: string }>
}) {
  const resolvedParams = await params
  const slug = resolvedParams?.slug || 'home'
  const page = await getCachedPage(slug, 'en')

  if (!page) return notFound()

  return <PageLivePreview initialPage={page} />
}
```
