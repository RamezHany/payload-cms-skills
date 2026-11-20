# Plugins & Extensions Selection Matrix (Prompt User Per Project)

In Gate 0, always present the relevant plugins from this matrix to the user and ask which ones to enable for the current project. Some plugins (like `@payloadcms/plugin-seo` and `payload-plugin-llms-txt` / `/llms.txt`) are recommended for almost every client, while others (like `@payloadcms/plugin-mcp`, `@payloadcms/plugin-multi-tenant`, or `@payloadcms/plugin-import-export`) should only be enabled when the specific client or project requires them.

## 1. Decision Matrix: Which Plugins to Enable?

| Plugin Package | Category | Default Recommendation | When to Enable / Ask the User |
| :--- | :--- | :--- | :--- |
| **`@payloadcms/plugin-seo`** | SEO / AEO / GEO | **Always ON** (Default) | Every website with public pages, blog posts, courses, or products. |
| **`payload-plugin-llms-txt`** (or `/llms.txt` route) | GEO / AI Search | **Always ON** (Default) | Generates `/llms.txt` and `/llms-full.txt` so ChatGPT, Perplexity, Claude, and Gemini index site content accurately. |
| **`payload-seo-analyzer`** | Live SEO & AI Score | **Optional (Ask)** | Enable when content editors want a live 0–100 on-page SEO + AI-readiness score in the sidebar, plus automatic sitemaps and JSON-LD builders. |
| **`@payloadcms/plugin-redirects`** | SEO Redirects | **Recommended** | Enable for site redesigns, migrations, or blogs/stores where page URLs (`slug`) might change and need `301`/`302` redirects. |
| **`@payloadcms/plugin-nested-docs`** | Hierarchy & Breadcrumbs | **Optional (Ask)** | Enable when pages or categories have parent/child trees (e.g., `/services/web-development/nextjs`) and need automatic breadcrumbs. |
| **`@payloadcms/plugin-search`** | Fast Search Index | **Optional (Ask)** | Enable when the frontend has a search bar across pages, blog posts, courses, or products. Creates a lightweight, fast-indexed search collection. |
| **`@payloadcms/plugin-form-builder`** | Dynamic Admin Forms | **Optional (Ask)** | Enable when the client wants to build new forms dynamically from the CMS dashboard. (If forms are fixed in the frontend design, use the custom `FormSubmissions` collection with CSV export instead). |
| **`@payloadcms/plugin-import-export`** | Bulk CSV/JSON Import & Export | **Optional (Ask)** | Enable when the client manages large catalogs (courses, products, registered students, articles) and needs bulk CSV/JSON import and export across collections. |
| **`payload-plugin-ai-localization` / `payload-ai`** | AI Content & Translation | **Optional (Ask)** | Enable on multi-language sites when the client wants a 1-click "AI Translate" button in the Admin UI (requires an OpenAI/Anthropic API key). |
| **`@payloadcms/plugin-mcp`** | AI Agent MCP Server | **Client-Specific (Ask First!)** | Exposes collections to external AI tools via Model Context Protocol. **Not for every client** — only enable when the client or agency explicitly wants AI agents (Claude Desktop, Cursor, automation bots) to query/manage CMS content. |
| **`@payloadcms/plugin-multi-tenant`** | Multi-Tenancy | **SaaS Only (Ask First!)** | Enable ONLY when a single Payload instance hosts multiple isolated client websites, branches, or brands. |

## 2. Ready-to-Use Configuration Snippets

### A. Redirects, Nested Docs & Search Plugins (`src/plugins/corePlugins.ts`)

```ts
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { searchPlugin } from '@payloadcms/plugin-search'
import { revalidateTag } from 'next/cache'

export const optionalCorePlugins = [
  // 1. Redirects Plugin (301/302 URL management)
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      admin: {
        group: 'SEO & Routing',
        hideAPIURL: true,
      },
      hooks: {
        afterChange: [
          ({ doc }) => {
            try {
              revalidateTag('collection:redirects')
            } catch {}
            return doc
          },
        ],
      },
    },
  }),

  // 2. Nested Docs Plugin (Parent/Child hierarchy + Breadcrumbs)
  nestedDocsPlugin({
    collections: ['pages'],
    generateLabel: (_, doc) => doc.title as string,
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),

  // 3. Fast Search Index Plugin
  searchPlugin({
    collections: ['pages', 'posts', 'courses'],
    defaultPriorities: {
      pages: 10,
      courses: 20,
      posts: 30,
    },
    searchOverrides: {
      admin: {
        group: 'System',
        hideAPIURL: true,
      },
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: 'excerpt', type: 'textarea' },
      ],
    },
  }),
]
```

### B. Bulk Import/Export Plugin (`@payloadcms/plugin-import-export`)

```ts
import { importExportPlugin } from '@payloadcms/plugin-import-export'

// Add inside plugins array in payload.config.ts when requested:
importExportPlugin({
  collections: ['courses', 'course-bookings', 'posts', 'form-submissions'],
})
```

### C. Model Context Protocol Plugin (`@payloadcms/plugin-mcp`) — Opt-In Only

Only enable when the user confirms they want MCP enabled for this client:

```ts
import { mcpPlugin } from '@payloadcms/plugin-mcp'

// Add inside plugins array in payload.config.ts ONLY when confirmed:
mcpPlugin({
  collections: {
    pages: { enabled: true },
    posts: { enabled: true },
    courses: { enabled: true },
  },
})
```
