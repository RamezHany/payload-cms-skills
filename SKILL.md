---
name: payload-cms-architect
description: Build, refactor, debug, and extend full-stack Payload CMS v3 + Next.js applications from scratch, from existing frontend templates, or on existing brownfield projects. Use whenever the user asks to set up Payload CMS, refactor/fix errors in an existing Payload project, inject new features (like Paymob payments, executive analytics dashboards, caching, localization, SEO/AEO/GEO, official/community plugins, courses/bookings, or forms), customize admin branding/theming, set up cache-first database reads, or implement Super Admin/Admin RBAC with OTP email password reset and first-login password change.
---

# Payload CMS Architect

End-to-end blueprint for building new Payload CMS v3 + Next.js applications, converting existing frontend designs into dynamic CMS sites, or **refactoring, debugging, and injecting new features into existing projects**. Designed with deterministic step-by-step gates, pre-wired templates, and copy-pasteable reference patterns so both flagship reasoning models and lightweight/budget models execute every requirement accurately without hallucinating.

## When to Use

- **Greenfield / Frontend-to-CMS Conversion**: Converting an existing Next.js frontend design into a dynamic Payload CMS v3 site while preserving 100% of its original content and section order.
- **Brownfield Refactoring & Bug Fixing**: Auditing an existing Payload CMS project to fix bugs, upgrade Next.js/Payload versions, eliminate un-cached DB queries, fix hook loops, or resolve UI contrast/styling issues.
- **Incremental Feature Injection**: Adding a missing capability to an existing site (e.g., adding Paymob payment gateway, an Executive Analytics Dashboard, course bookings, cache-first reads, multi-language localization, SEO/AEO/GEO, or Form Submissions with CSV export).
- **Admin UI Customization, Executive Dashboard & Security**: Applying client logo/icon branding, contrast-safe themes, modern tables, a live KPI Executive Dashboard (registered users, courses, course bookings, blog articles, form leads, orders), hiding API URLs/tabs, Super Admin `.env` seeding, Admin RBAC, 6-digit OTP password reset via Resend, and forced first-login password change.

## Mandatory Execution Gates (Follow in Exact Order)

### Gate 0: Pre-Flight Mode, Stack, Payment Gateway & Plugins Confirmation (STOP & ASK FIRST)

Before installing packages or modifying code, **always confirm with the user** in a single concise message:

1. **Operation Mode**: Confirm whether we are (A) **Building/Converting a full CMS**, (B) **Refactoring & fixing bugs in an existing project**, or (C) **Injecting specific new features** into an existing project.
2. **Database**: Confirm whether to use the default **Turso / libSQL SQLite** (`@payloadcms/db-sqlite`) or switch to PostgreSQL (`@payloadcms/db-postgres`) / MongoDB (`@payloadcms/db-mongodb`).
3. **Media Storage**: Confirm whether to use the default **Cloudinary** storage adapter (`@payloadcms/plugin-cloud-storage` + `cloudinary`) or switch to S3 / Cloudflare R2 / Vercel Blob / local storage.
4. **Email Service**: Confirm whether to use the default **Resend API** (`@payloadcms/email-resend`) or SMTP (`@payloadcms/email-nodemailer`).
5. **Localization**: Confirm which languages are needed (e.g., English only, or English + Arabic with RTL support).
6. **Payment Gateway**: Ask explicitly: **"Do you want to enable or add a payment gateway (Default: Paymob Intention API + Unified Checkout + HMAC-SHA512 webhook security) for this project, or skip payments?"**
7. **Project-Specific Plugins Selection** (consult **[reference/PLUGINS-ECOSYSTEM.md](reference/PLUGINS-ECOSYSTEM.md)**):
   - Explain that `@payloadcms/plugin-seo` + `/llms.txt` (GEO/AEO) are enabled by default.
   - Ask which optional plugins from the ecosystem should be enabled for **this specific client/project**:
     - `@payloadcms/plugin-redirects` (301/302 URL redirects)
     - `@payloadcms/plugin-nested-docs` (hierarchical parent/child pages & breadcrumbs)
     - `@payloadcms/plugin-search` (fast indexed search collection)
     - `@payloadcms/plugin-import-export` (bulk CSV/JSON import & export for collections)
     - `@payloadcms/plugin-form-builder` (dynamic admin-created forms, vs fixed frontend forms)
     - `payload-seo-analyzer` (live 0–100 SEO & AI-readiness sidebar score)
     - `payload-plugin-ai-localization` / `payload-ai` (1-click AI translation & content generation)
     - `@payloadcms/plugin-mcp` (Model Context Protocol server for AI agents — **ask first, not for every client**)
     - `@payloadcms/plugin-multi-tenant` (multi-tenant isolation — **only for multi-brand/SaaS projects**)

Wait for the user's confirmation before executing the remaining gates.

### Gate 1: Next.js Latest Upgrade, Refactoring Audit & Compatibility Check

If working on an existing project (Refactoring, Bug Fixing, or Feature Injection), read and follow **[reference/REFACTORING-AND-FEATURE-INJECTION.md](reference/REFACTORING-AND-FEATURE-INJECTION.md)** first:

1. Inspect `package.json`. Ensure `next`, `react`, `react-dom`, `payload`, and all `@payloadcms/*` packages are on the latest compatible stable release (with all `@payloadcms/*` versions pinned in lockstep).
2. If the project uses an older Next.js version, upgrade `next`, `react`, and `react-dom`, and fix breaking App Router changes (such as awaiting `params` and `searchParams` Promises in Next.js 15+ page/route handlers, and wrapping `next.config.mjs` with `withPayload`).
3. Audit existing code for security/performance bugs (un-cached `payload.find` calls on the frontend, missing `overrideAccess: false` when passing `user`, missing `req` in hook transactions, infinite `afterChange` loops, or visible API URLs) and fix them non-destructively without losing existing fields or data.
4. Always use native Payload parameters, field types, and helpers (`slugField()`, `blocks`, `array`, `tabs`, `row`, `relationship`, `upload`, `join`, `virtual`) instead of reinventing custom database tables. Consult **[templates/payload.config.ts](templates/payload.config.ts)** for a full reference implementation.

### Gate 2: Custom Branding, Contrast-Safe Theme, Modern Tables & Executive Dashboard

Read and apply **[reference/BRANDING-AND-THEMING.md](reference/BRANDING-AND-THEMING.md)**, **[reference/ADMIN-DASHBOARD-WIDGETS.md](reference/ADMIN-DASHBOARD-WIDGETS.md)**, and **[templates/custom.scss](templates/custom.scss)**:

1. **Client Logo & Favicon**: Locate the client or website logo and favicon from the frontend assets (`public/` or `src/assets/`). Register custom `Logo` and `Icon` components under `admin.components.graphics` and set `admin.meta.icons` and `admin.meta.titleSuffix` in `src/payload.config.ts`.
2. **Match Frontend Brand Palette**: Extract the frontend's primary/secondary brand colors and typography (`tailwind.config.*` or `globals.css`) and apply them to `src/app/(payload)/custom.scss`.
3. **Strict Contrast Rule (No Light-on-Light or Dark-on-Dark)**:
   - Never place light text on a light background or dark text on a dark background.
   - Maintain a minimum **4.5:1 WCAG contrast ratio** across all surfaces (`--theme-bg`, `--theme-elevation-*`, `--theme-input-bg`, table headers, badges, and buttons) in both `[data-theme="light"]` and `[data-theme="dark"]`.
   - If the client's primary brand color is bright/light (relative luminance `L > 0.45`, such as yellow, lime, cyan, or light gold), set `--brand-primary-foreground: #0f172a` (dark text) on `.btn--style-primary`, never white text.
4. **Modern Table Styling**: Include the `.table` rules from `templates/custom.scss` so all collection and form submission tables have clean borders, uppercase headers, zebra striping, and generous cell padding.
5. **Executive Analytics Dashboard (`beforeDashboard`)**: Always mount `ExecutiveDashboard` (`src/components/admin/ExecutiveDashboard.tsx`) in `admin.components.beforeDashboard`. It dynamically detects the site's active collections and renders live KPI cards and recent activity tables as soon as the admin logs in:
   - Total Registered Users / Members (`users`)
   - Total Active Courses (`courses`) & Total Booked Courses / Student Reservations (`course-bookings` / `bookings` / `enrollments`) when the site offers courses (see **[reference/COURSES-AND-BOOKINGS.md](reference/COURSES-AND-BOOKINGS.md)**)
   - Total Blog Articles / Posts (`posts` / `articles` / `blogs`) when the site has a blog
   - Total Website Pages (`pages`), Form Submissions / Unread Leads (`form-submissions`), and Completed Payments (`orders`)

### Gate 3: Cache-First Reads & Instant On-Save Revalidation

Read and apply **[reference/CACHING-AND-REVALIDATION.md](reference/CACHING-AND-REVALIDATION.md)**:

1. **Never query the database directly on every visitor request.** Wrap all frontend Payload Local API queries (`pages`, collections, globals) inside `unstable_cache` (in `src/lib/cached-payload.ts`) with `revalidate: false` and granular cache tags (`cms-content`, `collection:<slug>`, `page:<slug>`, `global:<slug>`, `locale:<code>`).
2. **Revalidate Only on Admin Edit**: Attach `revalidateCollectionCache` (`afterChange`) and `revalidateCollectionDelete` (`afterDelete`) to every content collection, and `revalidateGlobalCache` (`afterChange`) to every global. When an admin edits content, `revalidateTag` and `revalidatePath` clear the cache immediately so the very next read fetches fresh data from the database once and caches it again.

### Gate 4: Super Admin, RBAC, OTP Forgot Password, First-Login Force Change & Hidden API

Read and apply **[reference/AUTH-AND-SECURITY.md](reference/AUTH-AND-SECURITY.md)**:

1. **Super Admin in `.env`**: Seed the Super Admin account inside `onInit` (`ensureSuperAdmin`) reading `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `.env` (see **[templates/env.example](templates/env.example)**).
2. **Admin Creation & RBAC**: Configure `src/collections/Users.ts` with `roles` (`super-admin`, `admin`) and `saveToJWT: true`. Super Admins and Admins can create and manage Admin users for the site.
3. **6-Digit OTP Password Recovery via Resend**: Configure `@payloadcms/email-resend` with `RESEND_API_KEY` and mount the custom `/request-otp` and `/verify-otp-reset` endpoints on `Users` along with `OtpPasswordResetModal` in `admin.components.afterLogin`. Admins receive a 6-digit code by email and enter it to reset their password.
4. **First-Login Forced Password Change**: Set `mustChangePassword: true` by default on newly created users (including initial Super Admin seed). Mount `ForcePasswordChangeGate` in `admin.components.header` so any admin logging in for the first time must set a new password before using the dashboard.
5. **Completely Hide API URLs & Tabs**: Wrap **every** collection and global with `withHiddenAPI()` (`admin.hideAPIURL: true` and `admin.components.views.edit.api.tab.condition: () => false`) plus the CSS fallback in `custom.scss` so neither Admin nor Super Admin ever sees raw API URLs or the API tab in the dashboard.

### Gate 5: Frontend Decomposition, Exact Content Seeding, Dynamic Sections & Localization

Read and apply **[reference/FRONTEND-SEEDING-AND-LIVE-PREVIEW.md](reference/FRONTEND-SEEDING-AND-LIVE-PREVIEW.md)**:

1. **Dynamic Reorderable Sections (`blocks`)**: Convert every frontend page section into a Payload `Block` config and attach them to a `layout` field (`type: 'blocks'`) on `Pages` so admins can reorder, add, or remove sections dynamically.
2. **Zero-Loss Content Seeding**: Extract 100% of the existing text, headings, buttons, list items, and images from the provided frontend components and create an automatic seed script (`seedInitialContent` called in `onInit` when `pages` is empty). The frontend must render the exact original content and section order from the database without altering a single word or image.
3. **Multi-Language Localization**: When the site supports multiple languages, configure `localization` in `payload.config.ts` (`locales`, `defaultLocale`, `fallback: true`) and mark content fields with `localized: true`. Admins edit English, click Save, switch the language selector in the CMS, and edit the translated version.
4. **Live Preview**: Configure `admin.livePreview` on content collections/globals and wire `useLivePreview` from `@payloadcms/live-preview-react` on the frontend so admins see a real-time visual preview as they type and reorder blocks.

### Gate 6: Form Submissions Table & One-Click CSV Export

Read and apply **[reference/FORMS-AND-CSV-EXPORT.md](reference/FORMS-AND-CSV-EXPORT.md)**:

1. Connect every frontend form to save submissions into `src/collections/FormSubmissions.ts` (or `@payloadcms/plugin-form-builder`).
2. Configure `defaultColumns` to display key details (`formName`, `senderName`, `senderEmail`, `senderPhone`, `status`, `createdAt`) in a styled admin table.
3. Mount `ExportSubmissionsCsvButton` in `admin.components.beforeListTable` linked to `/api/form-submissions/export-csv` (with UTF-8 BOM `\uFEFF` for clean Arabic/Excel rendering).

### Gate 7: SEO, AEO (Answer Engine), GEO (Generative Engine) & Selected Plugins

Read and apply **[reference/STACK-AND-SEO-AEO-GEO.md](reference/STACK-AND-SEO-AEO-GEO.md)** and **[reference/PLUGINS-ECOSYSTEM.md](reference/PLUGINS-ECOSYSTEM.md)**:

1. Configure `@payloadcms/plugin-seo` with `tabbedUI: true`, auto-generators (`generateTitle`, `generateDescription`), and custom AEO/GEO fields (`aiSummary` and `faqSchema`).
2. Create the `/llms.txt` route handler (`src/app/llms.txt/route.ts`) or configure `payload-plugin-llms-txt` to expose a clean machine-readable index for AI engines (ChatGPT, Perplexity, Claude, Gemini).
3. Render `JsonLdSchema` (`WebPage` + `FAQPage` Schema.org JSON-LD) on frontend pages.
4. Configure all additional plugins confirmed by the user in Gate 0 (`redirectsPlugin`, `nestedDocsPlugin`, `searchPlugin`, `importExportPlugin`, `mcpPlugin`, `multiTenantPlugin`, etc.).

### Gate 8: Optional Paymob Payment Gateway Integration

If the user confirmed enabling or adding payments in Gate 0, read and apply **[reference/PAYMOB-INTEGRATION.md](reference/PAYMOB-INTEGRATION.md)**:

1. Create the `Orders` collection (`src/collections/Orders.ts`) to log all payment intentions and transaction statuses in the CMS.
2. Implement `createPaymobIntention` (`POST /v1/intention/`) redirecting customers to Unified Checkout (`/unifiedcheckout/?publicKey=...&clientSecret=...`).
3. Implement `POST /api/paymob/webhook` with strict **20-field lexicographical HMAC-SHA512 verification** (`verifyPaymobPostWebhookHmac` using `crypto.timingSafeEqual`). Never trust unverified browser redirects to mark orders as paid.

## Reference Library Index

Always consult the specific reference file before writing or refactoring code for that subsystem:

- **[templates/](templates/)** - Pre-wired production templates:
  - `templates/payload.config.ts`: Complete config with all adapters, plugins, localization, graphics, and hooks.
  - `templates/env.example`: Full environment variables template.
  - `templates/custom.scss`: Complete theme with WCAG contrast tokens and `.table` styling.
- **[reference/DEBUGGING-AND-TROUBLESHOOTING.md](reference/DEBUGGING-AND-TROUBLESHOOTING.md)** - Common pitfalls & fixes (Next.js 15 async params, `@payload-config` alias, SQLite database locking, stale import maps, Paymob HMAC issues, infinite hook loops).
- **[reference/COURSES-AND-BOOKINGS.md](reference/COURSES-AND-BOOKINGS.md)** - Complete schemas and flows for Courses, Course Bookings/Enrollments, Blog Posts, and CSV export.
- **[reference/PLUGINS-ECOSYSTEM.md](reference/PLUGINS-ECOSYSTEM.md)** - Complete plugin selection matrix and config templates (`@payloadcms/plugin-seo`, `payload-plugin-llms-txt`, `payload-seo-analyzer`, `redirects`, `nested-docs`, `search`, `form-builder`, `import-export`, `payload-ai`, `mcp`, `multi-tenant`).
- **[reference/ADMIN-DASHBOARD-WIDGETS.md](reference/ADMIN-DASHBOARD-WIDGETS.md)** - Adaptive `ExecutiveDashboard` Server Component (`beforeDashboard`) showing live KPI cards for Registered Users, Active Courses, Course Bookings, Blog Articles, Pages, Form Leads, and Completed Payments.
- **[reference/REFACTORING-AND-FEATURE-INJECTION.md](reference/REFACTORING-AND-FEATURE-INJECTION.md)** - Non-destructive brownfield audit checklist, Next.js/Payload version upgrade fixes, and incremental feature injection playbooks.
- **[reference/AUTH-AND-SECURITY.md](reference/AUTH-AND-SECURITY.md)** - Super Admin `.env` seed, RBAC (`super-admin` / `admin`), 6-digit OTP email reset via Resend, first-login forced password change modal, and `withHiddenAPI` helper.
- **[reference/CACHING-AND-REVALIDATION.md](reference/CACHING-AND-REVALIDATION.md)** - `unstable_cache` helpers (`getCachedPage`, `getCachedCollection`, `getCachedGlobal`) and `afterChange`/`afterDelete` cache invalidation hooks.
- **[reference/BRANDING-AND-THEMING.md](reference/BRANDING-AND-THEMING.md)** - Custom client `Logo` and `Icon`, WCAG 4.5:1 contrast rules (no light-on-light), light/dark theme variables, and modern `.table` CSS.
- **[reference/FRONTEND-SEEDING-AND-LIVE-PREVIEW.md](reference/FRONTEND-SEEDING-AND-LIVE-PREVIEW.md)** - Decomposing frontend into dynamic `blocks`, verbatim initial database seeding, multi-locale workflow, and `@payloadcms/live-preview-react`.
- **[reference/FORMS-AND-CSV-EXPORT.md](reference/FORMS-AND-CSV-EXPORT.md)** - `FormSubmissions` collection, admin table configuration, and UTF-8 BOM CSV export endpoint + button.
- **[reference/STACK-AND-SEO-AEO-GEO.md](reference/STACK-AND-SEO-AEO-GEO.md)** - Turso/libSQL adapter, Cloudinary storage adapter, Resend adapter, `@payloadcms/plugin-seo`, AEO JSON-LD schema, and GEO `/llms.txt` route.
- **[reference/PAYMOB-INTEGRATION.md](reference/PAYMOB-INTEGRATION.md)** - Paymob Intention API (`/v1/intention/`), Unified Checkout, `Orders` collection, and 20-field HMAC-SHA512 webhook verification.
- **[reference/FIELDS.md](reference/FIELDS.md)** & **[reference/FIELD-TYPE-GUARDS.md](reference/FIELD-TYPE-GUARDS.md)** - All native Payload field types, `slugField()`, blocks, arrays, tabs, and runtime type guards.
- **[reference/COLLECTIONS.md](reference/COLLECTIONS.md)** & **[reference/HOOKS.md](reference/HOOKS.md)** - Collection patterns, drafts/versions, globals, and hook lifecycle rules.
- **[reference/ACCESS-CONTROL.md](reference/ACCESS-CONTROL.md)** & **[reference/ACCESS-CONTROL-ADVANCED.md](reference/ACCESS-CONTROL-ADVANCED.md)** - Collection, field, and global access control patterns.
- **[reference/QUERIES.md](reference/QUERIES.md)**, **[reference/ENDPOINTS.md](reference/ENDPOINTS.md)**, **[reference/ADAPTERS.md](reference/ADAPTERS.md)**, **[reference/ADVANCED.md](reference/ADVANCED.md)**, **[reference/PLUGIN-DEVELOPMENT.md](reference/PLUGIN-DEVELOPMENT.md)** - Core Payload CMS v3 reference documentation.

## Critical Gotchas to Avoid

- **Local API Access Bypass**: `payload.find()` bypasses access control by default (`overrideAccess: true`). Whenever passing `user` in a user-facing route, you MUST set `overrideAccess: false`.
- **SQLite / Turso Transactions**: Always set `transactionOptions: {}` in `sqliteAdapter` and pass `req` into nested hook operations (`req.payload.create({ ..., req })`) to prevent partial writes or database locks.
- **Next.js 15 Async Params**: Always `const { slug } = await params` in Next.js 15+ Server Components and route handlers.
- **Infinite Hook Loops**: When updating a document inside `afterChange`, always set `context: { skipHooks: true, disableRevalidate: true }` and guard at the top of the hook with `if (context.skipHooks) return`.
- **Stale TypeScript Types & Import Map**: Run `pnpm payload generate:types` and `pnpm payload generate:importmap` whenever fields, blocks, or custom admin components change.
