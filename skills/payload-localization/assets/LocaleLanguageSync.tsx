'use client'

import { useConfig, useLocale, useTranslation } from '@payloadcms/ui'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'

type Snapshot = { language: string; locale: string | undefined }

// Keeps the admin interface language and the content locale on the same code.
// On entry and after a language change, the content locale follows the admin language.
// After a locale change in the document header, the admin language follows the locale.
export function LocaleLanguageSync({ children }: { children?: ReactNode }) {
  const locale = useLocale()
  const { i18n, languageOptions, switchLanguage } = useTranslation()
  const { config } = useConfig()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previous = useRef<Snapshot | null>(null)

  const language = i18n.language
  const localeCode = locale?.code

  useEffect(() => {
    const last = previous.current
    previous.current = { language, locale: localeCode }
    if (!localeCode || language === localeCode) return

    const localeChanged = last !== null && last.locale !== localeCode
    if (localeChanged) {
      const match = languageOptions.find((option) => option.value === localeCode)
      if (match && switchLanguage) void switchLanguage(match.value)
      return
    }

    const locales = config.localization ? config.localization.locales : []
    if (!locales.some((item) => item.code === language)) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('locale', language)
    router.replace(`${pathname}?${params.toString()}`)
  }, [config.localization, language, languageOptions, localeCode, pathname, router, searchParams, switchLanguage])

  return <>{children}</>
}
