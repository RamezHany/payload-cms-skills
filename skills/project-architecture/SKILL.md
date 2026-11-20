---
name: project-architecture
description: Canonical folder and file architecture for Payload CMS 3 + Next.js App Router projects, with code conventions and a refactor-first playbook. Use when creating any new file, deciding where code belongs, reviewing structure, or before adding a backend to a frontend built by another agent or tool (Next.js, Vite, Create React App, Lovable). Refactors to the standard with zero visual change before any backend work.
license: MIT
metadata:
  version: "1.0.0"
---

# Project architecture

One layout for every project, so any model finds any file without searching. The layout extends the official Payload website template instead of inventing a new one.

## When to use

| Situation | Action |
| --- | --- |
| Creating a file | Place it using the table in Step 1 |
| New project from the template | Apply Step 2 once, right after bootstrap |
| Existing frontend without Payload | Run the refactor-first playbook (Step 3) before any backend work |
| Vite, Create React App, or Lovable export | Run the migration section of the playbook first |

## Step 1: Where code goes

Full tree with examples: [references/folder-structure.md](references/folder-structure.md).

| Code | Location |
| --- | --- |
| Public routes | `src/app/(frontend)/` (or `src/app/(frontend)/[locale]/` when localized) |
| Payload admin and REST routes | `src/app/(payload)/` (generated; only `custom.scss` is edited) |
| Preview routes | `src/app/(frontend)/next/preview/route.ts`, `next/exit-preview/route.ts` |
| Machine-readable routes | `src/app/llms.txt/route.ts`, `src/app/sitemap.ts`, `src/app/robots.ts` |
| Collections | `src/collections/<Name>.ts`; becomes `src/collections/<Name>/index.ts` with `hooks/` and `access/` once it has hooks |
| Globals | `src/globals/<Name>/config.ts` with `Component.tsx` and `hooks/` beside it |
| Layout blocks | `src/blocks/<Name>/config.ts` + `Component.tsx` |
| Reusable fields | `src/fields/<fieldName>.ts` |
| Shared access functions | `src/access/<rule>.ts` |
| Business features | `src/features/<feature>/` (booking, payments, leads) |
| Design system primitives | `src/components/ui/` |
| Page sections | `src/components/sections/` |
| Admin custom components | `src/components/admin/` |
| Server-only clients (Payload, Google, email, storage) | `src/lib/` |
| Pure helpers | `src/utilities/` |
| Translations and routing | `src/i18n/` |
| Request proxy (Next.js 16) | `src/proxy.ts` |
| Tests | `tests/e2e/`, `tests/int/` |

Rules:

1. One component per file. File name matches the export (`BookingForm.tsx` exports `BookingForm`).
2. Collection and global folders use PascalCase (`Posts`, `SiteSettings`). Slugs are kebab-case (`site-settings`).
3. A feature folder owns everything specific to it: `schema.ts` (Zod), `actions.ts` (server actions), `queries.ts` (TanStack Query hooks), `components/`, `server/` (server-only code).
4. Code used by two or more features moves to `src/components`, `src/lib`, or `src/utilities`.
5. Server-only modules start with `import 'server-only'`.

## Step 2: Normalize a fresh template

Run once after `payload-bootstrap` creates the project, before writing features.

1. Move `src/Header` to `src/globals/Header` and `src/Footer` to `src/globals/Footer`.
2. Search the project for these strings and update each match:
   - `@/Header/` becomes `@/globals/Header/`
   - `@/Footer/` becomes `@/globals/Footer/`
   - relative imports of `./Header` or `./Footer` in `src/payload.config.ts`
3. Run `pnpm generate:importmap`, then `pnpm tsc --noEmit`. Both must pass.
4. Open `/admin`, then open the Header global. It must render without an import map error.
5. Commit: `refactor: move globals into src/globals`.

Leave the rest of the template where it is (`src/heros`, `src/blocks`, `src/components/ui`). The template's `components/ui` primitives may stay for template blocks; new UI follows the project design system, not shadcn/ui.

## Step 3: Refactor-first playbook

When another agent or tool built the frontend, restructure it before adding Payload. The goal is the layout above with **zero visual or behavioral change**.

Summary (full procedure: [references/refactor-playbook.md](references/refactor-playbook.md)):

1. Inventory: list routes, components, data sources, and hardcoded content. Write the list into `PROJECT.md`.
2. Baseline: capture a screenshot of every route at 375 px and 1440 px widths with Playwright, and save them under `tests/e2e/__baseline__/`.
3. Move files into the canonical layout in small commits. Change imports only. No styling or logic edits.
4. Extract hardcoded content into typed constants in the component's folder, ready to be replaced by CMS data.
5. Compare: re-capture screenshots and diff them against the baseline. Any visible difference blocks the next step.
6. Only then run `payload-bootstrap` in "add to existing app" mode.

For Vite, Create React App, or Lovable exports, migrate to the Next.js App Router first, following the migration section of the playbook.

## Step 4: Code conventions

Apply [references/code-conventions.md](references/code-conventions.md) to every file. The essentials:

- Server Components by default. Add `'use client'` only for state, effects, or browser APIs, and keep client components small.
- Data reads in Server Components use the Payload Local API through `src/lib/payload.ts`.
- Client-side data uses TanStack Query with query keys from a `queryKeys` object in the feature folder.
- Forms use React Hook Form + Zod. One Zod schema per form in `schema.ts`, shared by the client form and the server action.
- No barrel files (`index.ts` that re-exports everything); import from the file directly.
- Imports at the top of the file. No inline or dynamic imports except `next/dynamic` for heavy client components.
- `switch` on a union type ends with a `never` check so new variants fail at compile time.

## Done when

- [ ] Every new file is in the location given by Step 1
- [ ] Globals live in `src/globals/` and the admin renders them
- [ ] For refactors: baseline and post-refactor screenshots match for every route
- [ ] `pnpm tsc --noEmit` and `pnpm lint` pass
