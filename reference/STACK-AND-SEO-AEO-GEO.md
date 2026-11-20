# Default Stack Adapters & SEO / AEO / GEO Configuration

Complete implementation patterns for the default stack (Turso/libSQL SQLite, Cloudinary Media Storage, Resend Email, Next.js latest upgrade) and Search/AI Engine Optimization (SEO, AEO, GEO).

## 1. Turso / libSQL Database Adapter (`@payloadcms/db-sqlite`)

```ts
import { sqliteAdapter } from '@payloadcms/db-sqlite'

export const dbAdapter = sqliteAdapter({
  client: {
    url: process.env.DATABASE_URL || 'file:./data/payload.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
  transactionOptions: {}, // Enables atomic transactions in SQLite/libSQL
})
```

## 2. Resend Email Adapter (`@payloadcms/email-resend`)

```ts
import { resendAdapter } from '@payloadcms/email-resend'

export const emailAdapter = resendAdapter({
  defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
  defaultFromName: process.env.EMAIL_FROM_NAME || 'CMS Admin',
  apiKey: process.env.RESEND_API_KEY || '',
})
```

## 3. Cloudinary Media Upload Adapter (`@payloadcms/plugin-cloud-storage` + `cloudinary`)

Using `@payloadcms/plugin-cloud-storage` with the official `cloudinary` v2 SDK guarantees compatibility across all Payload v3 minor releases:

```ts
// src/lib/cloudinaryAdapter.ts
import { v2 as cloudinary } from 'cloudinary'
import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const cloudinaryStorageAdapter = (): Adapter => {
  return ({ collection, prefix }): GeneratedAdapter => {
    return {
      name: 'cloudinary',
      handleUpload: async ({ data, file }) => {
        const folder = prefix || collection.slug || 'media'
        const uploadResult = await new Promise<any>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder,
              public_id: file.filename.replace(/\.[^/.]+$/, ''),
              resource_type: 'auto',
              overwrite: true,
            },
            (error, result) => {
              if (error) return reject(error)
              resolve(result)
            },
          )
          stream.end(file.buffer)
        })

        data.url = uploadResult.secure_url
        data.filename = uploadResult.public_id
      },
      handleDelete: async ({ doc }) => {
        if (doc?.filename) {
          await cloudinary.uploader.destroy(doc.filename).catch(() => null)
        }
      },
      staticHandler: async (req, { params }) => {
        return new Response('Not Found', { status: 404 })
      },
    }
  }
}
```

Enable in `src/payload.config.ts`:

```ts
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { cloudinaryStorageAdapter } from '@/lib/cloudinaryAdapter'

// Inside plugins array:
cloudStoragePlugin({
  collections: {
    media: {
      adapter: cloudinaryStorageAdapter(),
      disableLocalStorage: true,
      disablePayloadAccessControl: true, // Returns direct Cloudinary CDN URLs
    },
  },
})
```

## 4. SEO, AEO (Answer Engine Optimization) & GEO (Generative Engine Optimization)

### A. Official SEO Plugin + AEO/GEO Structured Fields

Configure `@payloadcms/plugin-seo` with custom AEO/GEO fields (`aiSummary` for LLM crawlers, `faqItems` for `FAQPage` JSON-LD schema, and `jsonLdType`) so every page is optimized for Google Search (SEO), AI Answer Engines like Perplexity/ChatGPT Search (AEO), and Generative Engines like Gemini/Claude (GEO):

```ts
import { seoPlugin } from '@payloadcms/plugin-seo'

export const seoAndGeoPlugin = seoPlugin({
  collections: ['pages', 'posts'],
  uploadsCollection: 'media',
  tabbedUI: true,
  generateTitle: ({ doc }) => `${doc?.title || 'Page'} | ${process.env.NEXT_PUBLIC_SITE_NAME || ''}`,
  generateDescription: ({ doc }) => doc?.excerpt || doc?.subheading || '',
  fields: ({ defaultFields }) => [
    ...defaultFields,
    {
      name: 'canonicalUrl',
      type: 'text',
      label: 'Canonical URL',
    },
    {
      name: 'aiSummary',
      type: 'textarea',
      label: 'AEO / GEO Direct Answer Summary (TL;DR for AI Crawlers & llms.txt)',
      localized: true,
      admin: {
        description:
          'Concise factual summary (40-80 words) used in JSON-LD description and /llms.txt for AI Answer Engines.',
      },
    },
    {
      name: 'faqSchema',
      type: 'array',
      label: 'AEO FAQ Schema (Generates FAQPage JSON-LD)',
      localized: true,
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'textarea', required: true },
      ],
    },
  ],
})
```

### B. Automatic `/llms.txt` Route Handler for GEO (`src/app/llms.txt/route.ts`)

Expose a cached `/llms.txt` endpoint (or install `payload-plugin-llms-txt`) so AI crawlers (OpenAI, Anthropic, Google Gemini, Perplexity) index the site's clean structure and direct answers:

```ts
// src/app/llms.txt/route.ts
import { getCachedCollection } from '@/lib/cached-payload'

export async function GET() {
  const pages = await getCachedCollection('pages', 'en', 200)
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Website'

  const lines: string[] = [
    `# ${siteName}`,
    '',
    `> Official machine-readable index for AI answer engines and generative search (GEO/AEO).`,
    '',
    '## Pages',
  ]

  for (const page of pages as any[]) {
    const url = `${baseUrl}/${page.slug === 'home' ? '' : page.slug}`
    const summary = page.meta?.aiSummary || page.meta?.description || page.title
    lines.push(`- [${page.title}](${url}): ${summary}`)
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
```

### C. Automatic JSON-LD Component for AEO (`src/components/frontend/JsonLdSchema.tsx`)

Render structured Schema.org JSON-LD (`WebPage` + `FAQPage`) on every frontend page:

```tsx
import React from 'react'

export const JsonLdSchema: React.FC<{ page: any }> = ({ page }) => {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const url = `${baseUrl}/${page.slug === 'home' ? '' : page.slug}`

  const schemas: any[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.meta?.title || page.title,
      description: page.meta?.aiSummary || page.meta?.description || '',
      url,
    },
  ]

  if (Array.isArray(page.meta?.faqSchema) && page.meta.faqSchema.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.meta.faqSchema.map((item: any) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    })
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  )
}
```
