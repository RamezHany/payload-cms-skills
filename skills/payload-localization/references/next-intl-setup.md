# next-intl setup for Payload projects

Versions: next-intl 4.x with Next.js 16. Check `pnpm view next-intl version` before installing.

## 1. Move frontend routes under `[locale]`

Move the template's frontend routes from `src/app/(frontend)/` into `src/app/(frontend)/[locale]/`: `page.tsx`, `[slug]/`, `posts/`, `search/`, `not-found.tsx`, and `layout.tsx`. Leave `next/` (preview routes) and `(sitemaps)/` where they are.

## 2. Routing

`src/i18n/routing.ts`:

```ts
import { defineRouting } from 'next-intl/routing'

import { defaultLocale, locales } from './locales'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
})
```

`src/i18n/navigation.ts`:

```ts
import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
```

Use this `Link` for internal links on the frontend so the locale prefix is kept.

## 3. Request config with static message imports

`src/i18n/request.ts`:

```ts
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import ar from './messages/ar.json'
import en from './messages/en.json'
import { routing } from './routing'

const messages = { en, ar }

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return { locale, messages: messages[locale] }
})
```

Add one import per locale. Keep message files flat by feature: `{ "nav": {...}, "booking": {...}, "footer": {...} }`.

## 4. Proxy

`src/proxy.ts`:

```ts
import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/((?!api|admin|next|_next|_vercel|llms|llm|.*\\..*).*)'],
}
```

The matcher skips any path that starts with those words. Do not create page slugs that start with `admin`, `api`, `next`, `llm`, or `llms`.

## 5. Locale layout

`src/app/(frontend)/[locale]/layout.tsx` (merge with the template layout's header, footer, admin bar, and providers):

```tsx
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'

import { rtlLocales } from '@/i18n/locales'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/providers/QueryProvider'

import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

type Props = {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

Delete `src/app/(frontend)/layout.tsx` after merging it into this file; two root layouts with `<html>` cannot coexist on the same route.

Call `setRequestLocale(locale)` at the top of every page and layout under `[locale]` so pages stay statically renderable.

## 6. Next.js config

```ts
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // existing options
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
```

## 7. Fonts for Arabic

Load a font with Arabic glyphs through `next/font/google` (for example IBM Plex Sans Arabic, Noto Sans Arabic, Cairo, or Tajawal) and apply it when `dir` is `rtl`. Subset to `arabic` and `latin` to keep the font files small.

## 8. Language switcher

Use the `Link` from `src/i18n/navigation.ts` with the `locale` prop, keeping the current pathname:

```tsx
'use client'

import { useLocale } from 'next-intl'

import { localeLabels, locales } from '@/i18n/locales'
import { Link, usePathname } from '@/i18n/navigation'

export function LanguageSwitcher() {
  const pathname = usePathname()
  const current = useLocale()
  return (
    <nav aria-label="Language">
      {locales
        .filter((locale) => locale !== current)
        .map((locale) => (
          <Link key={locale} href={pathname} locale={locale} hrefLang={locale}>
            {localeLabels[locale]}
          </Link>
        ))}
    </nav>
  )
}
```

Slugs are shared across locales by default, so the same pathname exists in every language.
