# Refactoring, Bug Fixing & Incremental Feature Injection (Brownfield Projects)

Use this workflow whenever the skill is applied to an **existing** Payload CMS + Next.js codebase to refactor architecture, fix bugs, upgrade Next.js/Payload versions, or inject a missing feature (e.g., adding Paymob payments, adding cache-first reads, adding localization, or hiding API URLs) without breaking existing functionality or losing database data.

## 1. Non-Destructive Audit Checklist (Run First on Existing Projects)

Before modifying any existing file, run a complete diagnostic audit:

1. **Version & Dependency Audit (`package.json`)**:
   - Check `next`, `react`, `react-dom`, `payload`, and `@payloadcms/*` versions.
   - Ensure all `@payloadcms/*` packages share the exact same version lockstep as `payload` (mismatched `@payloadcms/*` versions cause runtime React context and Drizzle schema errors).
   - If Next.js is outdated, upgrade to the latest stable version and update async `params` / `searchParams` in `page.tsx`, `layout.tsx`, and `route.ts` (`const { slug } = await params`).
2. **Config & Schema Audit (`src/payload.config.ts`)**:
   - Check which collections, globals, plugins, database adapter, storage adapter, and email adapter are currently active.
   - Check if any collections/globals are missing `withHiddenAPI()` (`hideAPIURL: true` + hidden API tab).
3. **Performance & Caching Audit**:
   - Search for direct `payload.find(` or `payload.findGlobal(` calls inside frontend Server Components (`src/app/(frontend)/**`).
   - Refactor un-cached frontend database calls to use `getCachedPage`, `getCachedCollection`, and `getCachedGlobal` (`unstable_cache` with `revalidate: false`) and attach `revalidateCollectionCache` / `revalidateGlobalCache` hooks to the corresponding collections/globals.
4. **Security & Hook Audit**:
   - Check for Local API calls passing `user` without `overrideAccess: false` (critical privilege escalation bug).
   - Check for nested `req.payload.create/update/delete` inside hooks missing the `req` parameter (breaks SQLite/Turso and Postgres transactions).
   - Check for `afterChange` hooks updating the same collection without a `context.skipHooks` guard (causes infinite recursion).
5. **UI Contrast & Branding Audit (`custom.scss`)**:
   - Inspect `custom.scss` and custom Admin components for low-contrast color combinations (e.g., light text on light brand backgrounds or dark text on dark surfaces in `[data-theme="dark"]`). Fix foreground tokens to guarantee >= 4.5:1 WCAG contrast.

## 2. Incremental Feature Injection Playbooks (Add-On Mode)

When asked to add a specific module to an existing project, **only touch the files required for that module** and preserve all existing collections, fields, and data:

### Playbook A: Adding Paymob Payment Gateway to an Existing Site
1. Read **[PAYMOB-INTEGRATION.md](PAYMOB-INTEGRATION.md)**.
2. Add `Orders` collection (`src/collections/Orders.ts`) wrapped with `withHiddenAPI` and register it in `payload.config.ts`.
3. Add `src/lib/paymob.ts` (`createPaymobIntention` + 20-field lexicographical `verifyPaymobPostWebhookHmac`).
4. Create `src/app/api/paymob/webhook/route.ts` and `src/app/(frontend)/payment/result/page.tsx`.
5. Wire the checkout button or booking/order form on the frontend to create an intention and redirect to Paymob Unified Checkout.
6. Append `PAYMOB_*` variables to `.env.example` and run `pnpm payload generate:types`.

### Playbook B: Retrofitting Cache-First Architecture onto an Existing Site
1. Read **[CACHING-AND-REVALIDATION.md](CACHING-AND-REVALIDATION.md)**.
2. Create `src/lib/cached-payload.ts` and `src/hooks/revalidateCache.ts`.
3. Append `revalidateCollectionCache` (`afterChange`) and `revalidateCollectionDelete` (`afterDelete`) to every content collection's `hooks` array (preserving any existing hooks in the array!).
4. Replace direct `payload.find` / `payload.findGlobal` calls in `src/app/(frontend)` with the cached wrappers.

### Playbook C: Retrofitting Super Admin, OTP Reset & First-Login Password Change
1. Read **[AUTH-AND-SECURITY.md](AUTH-AND-SECURITY.md)**.
2. Extend the existing `Users` collection with `roles`, `mustChangePassword`, `resetOtpHash`, `resetOtpExpires`, and the `/request-otp` and `/verify-otp-reset` endpoints without deleting existing custom user fields.
3. Add `ForcePasswordChangeGate` and `OtpPasswordResetModal` to `admin.components` in `payload.config.ts`.
4. Configure `@payloadcms/email-resend` and `ensureSuperAdmin` in `onInit`.

### Playbook D: Retrofitting Multi-Language Localization
1. Add `localization: { locales: ['en', 'ar'], defaultLocale: 'en', fallback: true }` to `payload.config.ts`.
2. Add `localized: true` to content fields (`text`, `textarea`, `richText`, `blocks`, `array`) across collections and globals.
3. Update frontend routes to pass the active `locale` into `getCachedPage(slug, locale)` and set `dir={locale === 'ar' ? 'rtl' : 'ltr'}` on the root HTML/layout container.

### Playbook E: Retrofitting SEO, AEO & GEO (`/llms.txt` + JSON-LD)
1. Read **[STACK-AND-SEO-AEO-GEO.md](STACK-AND-SEO-AEO-GEO.md)**.
2. Install and register `@payloadcms/plugin-seo` with the custom `aiSummary` and `faqSchema` fields.
3. Add `src/app/llms.txt/route.ts` and render `<JsonLdSchema page={page} />` inside the frontend page template.

## 3. Post-Refactor Verification Sequence

Always run these commands after refactoring or adding a feature to verify zero regressions:

```bash
# 1. Regenerate Payload TypeScript interfaces
pnpm payload generate:types

# 2. Regenerate Admin UI import map (required whenever admin components change)
pnpm payload generate:importmap

# 3. Run TypeScript compiler & Next.js production build check
pnpm tsc --noEmit && pnpm build
```
