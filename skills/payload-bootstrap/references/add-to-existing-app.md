# Add Payload to an existing Next.js app

Prerequisite: the app uses the App Router and every route lives under `src/app/(frontend)/` (done by the `project-architecture` refactor playbook). There must be no `src/app/layout.tsx`; the frontend layout is `src/app/(frontend)/layout.tsx`.

## 1. Install packages

Check each version with `pnpm view <package> version` and install the latest 3.x for all `@payloadcms/*` packages and `payload` (they must share one version).

```bash
pnpm add payload @payloadcms/next @payloadcms/richtext-lexical @payloadcms/db-sqlite @payloadcms/ui sharp graphql
```

## 2. Make the project ESM

Payload is ESM-only.

1. Add `"type": "module"` to `package.json`.
2. Rename CommonJS config files that use `module.exports` from `.js` to `.cjs` (for example `postcss.config.js` becomes `postcss.config.cjs`), or convert them to `export default`.
3. Rename `next.config.js` to `next.config.ts` (or `.mjs`).

## 3. Copy the admin routes

Copy the `(payload)` route group from the blank template on the `3.x` branch:

```bash
npx degit "payloadcms/payload/templates/blank/src/app/(payload)#3.x" "src/app/(payload)"
```

This creates `admin/[[...segments]]`, `api/[...slug]`, `api/graphql`, `api/graphql-playground`, `layout.tsx`, and `custom.scss`. Never edit these files except `custom.scss`.

## 4. Wrap the Next.js config

`next.config.ts`:

```ts
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // keep the existing options here
  // Required on Windows until Turbopack resolves Payload's Sass imports.
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
```

## 5. Add the config path alias

In `tsconfig.json` under `compilerOptions.paths`:

```json
"@payload-config": ["./src/payload.config.ts"]
```

## 6. Create the Payload config

`src/payload.config.ts`:

```ts
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Media } from './collections/Media'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || '',
      authToken: process.env.DATABASE_AUTH_TOKEN,
    },
  }),
  sharp,
})
```

Create `src/collections/Users/index.ts` with `auth: true` and `src/collections/Media.ts` with `upload: true` and a required `alt` text field. Copy their shapes from the website template on the `3.x` branch, then apply `payload-auth-rbac` and `payload-media`.

## 7. Add scripts

In `package.json`:

```json
"payload": "payload",
"generate:types": "payload generate:types",
"generate:importmap": "payload generate:importmap"
```

## 8. Add live preview, SEO, and the rest from the template

The blank template has none of the website template's features. Add them with the matching skills: `payload-live-preview`, `payload-seo-geo`, `payload-media`. Copy reference files from `templates/website` on the `3.x` branch instead of writing them from memory.

## 9. Verify

1. `pnpm generate:importmap`
2. `pnpm generate:types`
3. `pnpm tsc --noEmit`
4. `pnpm dev`, open `/admin`, create the first user, upload one image, and reload the page to confirm it persisted.
5. Compare the frontend against the visual baseline from the refactor playbook. No visible change is allowed.
