---
name: payload-localization
description: Multilingual Payload CMS 3 + Next.js sites - content locales, RTL (Arabic), translated admin interface that stays in sync with the content locale, next-intl localized routes with proxy.ts, and live preview in the editing language. Use when a site has more than one language, needs RTL, when the admin should switch language and direction together with the content being edited, or when localized pages show the wrong language.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload localization

Two separate Payload features work together here:

| Feature | Config key | Controls |
| --- | --- | --- |
| Admin interface language | `i18n` | Labels, buttons, and direction of the admin UI |
| Content localization | `localization` | Which language version of a document is edited and served |

The target behavior: an editor who works in Arabic sees an Arabic RTL admin, edits Arabic content, and the live preview shows the Arabic page. Switching either the admin language or the content locale switches both.

## Step 1: One locale list for the whole project

`src/i18n/locales.ts`:

```ts
export const locales = ['en', 'ar'] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = 'en'
export const rtlLocales: ReadonlySet<AppLocale> = new Set<AppLocale>(['ar'])
export const localeLabels: Record<AppLocale, string> = { en: 'English', ar: 'Arabic' }
```

Payload config and next-intl both import from this file, so they never drift.

## Step 2: Payload config

Install the translations package at the same version as `payload`: `pnpm add @payloadcms/translations@<payload version>`.

```ts
import { ar } from '@payloadcms/translations/languages/ar'
import { en } from '@payloadcms/translations/languages/en'

import { defaultLocale, localeLabels, locales, rtlLocales } from './i18n/locales'

// inside buildConfig({ ... })
i18n: {
  supportedLanguages: { en, ar },
  fallbackLanguage: defaultLocale,
},
localization: {
  locales: locales.map((code) => ({ code, label: localeLabels[code], rtl: rtlLocales.has(code) })),
  defaultLocale,
  fallback: true,
},
```

`supportedLanguages` keys must match the locale codes, or the sync in Step 3 cannot pair them.

## Step 3: Sync admin language and content locale

1. Copy [assets/LocaleLanguageSync.tsx](assets/LocaleLanguageSync.tsx) to `src/components/admin/LocaleLanguageSync.tsx`.
2. Register it as an admin provider:

```ts
admin: {
  components: {
    providers: ['@/components/admin/LocaleLanguageSync#LocaleLanguageSync'],
  },
},
```

3. Run `pnpm generate:importmap`.

Behavior:

- When an editor opens the admin, the content locale switches to the admin language.
- When the editor changes the admin language (account settings), the content locale follows.
- When the editor picks a locale in the document header, the admin language and direction follow.
- Live preview recomputes its URL with the new locale (set up in `payload-live-preview`), so the iframe follows too.

Skip this step only if `PROJECT.md` says editors must edit one language while the admin stays in another.

## Step 4: Localize fields

1. Add `localized: true` to text content: titles, rich text, excerpts, SEO fields, image `alt`.
2. Do not localize slugs (unless translated URLs are required), relationships, numbers, prices, dates, or status fields.
3. Drafts skip required-field validation; publishing does not. A required localized field must be filled in each locale before that locale can be published. If the client publishes one language at a time, keep `fallback: true` and document it in `PROJECT.md`.
4. Run `pnpm generate:types`. With SQLite, localized fields create `_locales` tables; in production this needs a migration (`payload-deploy-vercel`).

## Step 5: Frontend routing with next-intl

Install: `pnpm add next-intl`. Then create the files in [references/next-intl-setup.md](references/next-intl-setup.md):

- `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/messages/<locale>.json`
- `src/proxy.ts` (Next.js 16 uses `proxy.ts`; do not create `middleware.ts`)
- `src/app/(frontend)/[locale]/layout.tsx` with `lang` and `dir`
- `next.config.ts` wrapped with `createNextIntlPlugin`

Rules:

1. Static interface text (buttons, form labels, errors) lives in `messages/*.json`. Editable content lives in Payload.
2. Every `payload.find` on the frontend passes `locale`.
3. The proxy matcher excludes `api`, `admin`, `next` (preview routes), `_next`, `_vercel`, `llms`, `llm`, and files with extensions.
4. Use logical CSS properties and Tailwind logical utilities (`ms-4`, `pe-2`, `text-start`) so RTL works without separate styles.
5. Mirror directional icons (arrows, chevrons) with `rtl:rotate-180`.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Admin stays LTR when editing Arabic | Sync provider missing, or `ar` not in `supportedLanguages` | Step 2 and Step 3 |
| Admin language flips back and forth | Locale codes differ from language keys | Use identical codes in both lists |
| Frontend shows default language on `/ar/...` | `locale` not passed to `payload.find` | Step 5 rule 2 |
| `/admin` or `/next/preview` redirects to `/en/admin` | Proxy matcher does not exclude them | Step 5 rule 3 |
| Production save fails after adding `localized: true` | Missing migration for `_locales` tables | Create and run a migration |

## Done when

- [ ] `src/i18n/locales.ts` is the only place locale codes are defined
- [ ] Switching the admin language to Arabic switches the content locale to Arabic and the admin to RTL
- [ ] Switching the document locale switches the admin language
- [ ] Live preview shows the page in the locale being edited
- [ ] `/en/...` and `/ar/...` render the right content with correct `lang` and `dir`
- [ ] `/admin`, `/api`, `/next/preview`, and `/llms.txt` are not redirected by the proxy
