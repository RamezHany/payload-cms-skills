# Refactor-first playbook

Use this when a frontend exists (built by another agent, a no-code tool, or a developer) and Payload must be added. Restructure first, with zero visual change, then add the backend. Mixing restructuring and backend work in one step is the main source of regressions.

## Phase 1: Inventory (read only)

1. Read `package.json`. Record the framework, React version, styling approach, and every UI or animation library.
2. List every route and the component tree under it.
3. List every data source: hardcoded arrays, JSON files, `fetch` calls, environment variables.
4. List hardcoded content that the client will want to edit (headings, testimonials, team members, FAQs, prices, images).
5. Write the inventory into `PROJECT.md` under `## Inventory`, including a proposed collection or global for each editable content group.

## Phase 2: Baseline screenshots

1. Install Playwright if it is not present: `pnpm add -D @playwright/test`, then `pnpm exec playwright install chromium`.
2. Create `tests/e2e/visual-baseline.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

const routes = ['/', '/about', '/contact'] // fill from the inventory
const widths = [375, 1440]

for (const route of routes) {
  for (const width of widths) {
    test(`visual ${route} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot({ fullPage: true, maxDiffPixelRatio: 0.01 })
    })
  }
}
```

3. Run `pnpm exec playwright test tests/e2e/visual-baseline.spec.ts --update-snapshots` once to record the baseline. Commit the snapshots.

Disable or pause animations that make screenshots unstable by adding `animations: 'disabled'` to the `toHaveScreenshot` options.

## Phase 3: Restructure in small commits

Move one area per commit. Each commit changes paths and imports only.

1. Routes into `src/app/(frontend)/` (keep URLs identical).
2. Shared primitives into `src/components/ui/`.
3. Page sections into `src/components/sections/`.
4. Feature code into `src/features/<feature>/`.
5. Helpers into `src/utilities/` (pure) or `src/lib/` (server clients).
6. Configure the `@/*` path alias to `./src/*` in `tsconfig.json` if missing.

After each commit run `pnpm tsc --noEmit` and the visual test. Any failing snapshot means the commit changed behavior: revert it and redo the move.

## Phase 4: Prepare content seams

For each editable content group from the inventory:

1. Define a TypeScript type that matches the future Payload collection or global shape.
2. Move the hardcoded data into a typed constant next to the component that uses it.
3. Make the component receive the data through props instead of importing it.

This makes the later switch to Payload a one-line change in the page: replace the constant with a Local API query.

## Phase 5: Verify and hand off

1. Run the visual test. All snapshots must match.
2. Run `pnpm build` once.
3. Update `PROJECT.md`: inventory done, proposed data model, next phase is `payload-bootstrap` in "add to existing app" mode.

## Migration from Vite, Create React App, or Lovable

These are client-side single-page apps. Move them to the Next.js App Router before Phase 3.

1. Create a new Next.js app in a sibling folder with `pnpm create next-app@latest --ts --tailwind --app --src-dir --import-alias "@/*"`, then move it into place on a new branch. Do not edit the old app in place.
2. Copy `src/components`, `src/assets`, and styles. Keep Tailwind config values (colors, fonts, spacing) identical.
3. Convert routes: each React Router route becomes `src/app/(frontend)/<path>/page.tsx`. Replace `<Link to>` with `next/link` `<Link href>` and `useNavigate` with `useRouter` from `next/navigation`.
4. Mark components that use state, effects, or browser APIs with `'use client'`. Leave the rest as Server Components.
5. Replace `import.meta.env.VITE_*` with `process.env.NEXT_PUBLIC_*`.
6. Replace client-side data fetching with TanStack Query, or move it to a Server Component.
7. Lovable projects often include Supabase calls and shadcn/ui. Keep the shadcn components that the design uses as plain files in `src/components/ui/`; do not run `shadcn init`. Remove Supabase only after Payload replaces each call.
8. Record the baseline screenshots from the old app, then compare the new app against them before Phase 3.

## Stop and ask

- A route or behavior cannot be reproduced in Next.js without a visible change.
- The existing app depends on a backend service the brief does not mention.
- The design uses a paid component library the client has not licensed.
