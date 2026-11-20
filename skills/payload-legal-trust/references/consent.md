# Cookie consent

Library: `vanilla-cookieconsent` 3.3.0 (already pinned). API checked against the project docs on 2026-11-20:

- Configuration, including `mode`, `revision`, `respectGpc`, `categories`, `language.rtl`: [configuration reference](https://cookieconsent.orestbida.com/reference/configuration-reference.html)
- `revision` `0` disables re-prompting; any other number asks again when it changes: [revision management](https://cookieconsent.orestbida.com/advanced/revision-management.html)
- `CookieConsent.run`, `acceptedCategory`, `showPreferences`, and `data-cc="show-preferencesModal"`: [API reference](https://cookieconsent.orestbida.com/reference/api-reference.html) and [custom attribute](https://cookieconsent.orestbida.com/advanced/custom-attribute.html)
- Consent Mode example (`onFirstConsent`, `onConsent`, `onChange`, defaults denied): [Google consent mode](https://cookieconsent.orestbida.com/advanced/google-consent-mode.html)
- The four v2 signals: [Set up consent mode](https://developers.google.com/tag-platform/security/guides/consent)

Stylesheet path `vanilla-cookieconsent/dist/cookieconsent.css` is the file published in 3.3.0.

## consent-settings

`src/globals/ConsentSettings/config.ts`. Slug `consent-settings`. `read`: anyone. `update`: admin and editor. Group: `Settings`.

| Field | Localized | Notes |
| --- | --- | --- |
| `revision` | No | Number, required, default `1` |
| `title`, `description` | Yes | Banner heading and body |
| `acceptAllLabel`, `rejectAllLabel`, `manageLabel`, `saveLabel` | Yes | Buttons |
| `necessaryTitle`, `necessaryDescription` | Yes | Read-only category |
| `analyticsTitle`, `analyticsDescription` | Yes | |
| `marketingTitle`, `marketingDescription` | Yes | |
| `cookiePolicyLabel` | Yes | Link text. The href is always `/${locale}/legal/cookies` |

Hook:

```ts
import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook } from 'payload'

import { globalTag } from '@/utilities/revalidation'

export const revalidateConsentSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc
  // The cookie banner renders in the locale layout on every route.
  // One edit regenerates all routes x locales. Copy edits are rare.
  revalidateTag(globalTag('consent-settings'), { expire: 0 })
  req.payload.logger.info('revalidate (global_consent-settings): all routes that render the cookie banner')
  return doc
}
```

Read it with `unstable_cache`, the locale inside the cache key, and `tags: [globalTag('consent-settings')]`. Same shape as site-settings.

If any localized string for the active locale is empty, do not call `CookieConsent.run`. Leave the banner unmounted and stop for copy.

## Defaults before any tag

In the locale layout, which is the root layout (`<html>` lives there), a Server Component script:

```tsx
import Script from 'next/script'

const consentDefault = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
`

export function ConsentDefault() {
  return (
    <Script id="consent-default" strategy="beforeInteractive">
      {consentDefault}
    </Script>
  )
}
```

`beforeInteractive` is what puts this in the initial HTML from the root layout. The script does not load `googletagmanager.com`. Do not render `@next/third-parties` `GoogleAnalytics` in the layout. That component would request the tag immediately.

The four `denied` signals are the Consent Mode v2 set from Google's setup guide. `wait_for_update` is the millisecond pause so a later tag waits for the update call. If the current guide no longer lists `wait_for_update`, delete that one line and keep the four signals.

## Banner

`src/components/ConsentBanner.tsx` is `'use client'`. Import `* as CookieConsent from 'vanilla-cookieconsent'` and the stylesheet. Run once per page load (a module-level flag). Pass `language.autoDetect: 'document'` so the banner follows `<html lang>`.

```ts
CookieConsent.run({
  mode: 'opt-in',
  revision: settings.revision,
  respectGpc: true,
  autoClearCookies: true,
  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: {
      autoClear: {
        cookies: [{ name: /^_ga/ }, { name: '_gid' }],
      },
    },
    marketing: {},
  },
  language: {
    default: locale,
    autoDetect: 'document',
    rtl: [...rtlLocales],
    translations: {
      [locale]: {
        consentModal: {
          title: settings.title,
          description: settings.description,
          acceptAllBtn: settings.acceptAllLabel,
          acceptNecessaryBtn: settings.rejectAllLabel,
          showPreferencesBtn: settings.manageLabel,
        },
        preferencesModal: {
          title: settings.title,
          acceptAllBtn: settings.acceptAllLabel,
          acceptNecessaryBtn: settings.rejectAllLabel,
          savePreferencesBtn: settings.saveLabel,
          sections: [
            { title: settings.necessaryTitle, description: settings.necessaryDescription, linkedCategory: 'necessary' },
            { title: settings.analyticsTitle, description: settings.analyticsDescription, linkedCategory: 'analytics' },
            { title: settings.marketingTitle, description: settings.marketingDescription, linkedCategory: 'marketing' },
          ],
        },
      },
    },
  },
  onFirstConsent: () => { pushConsentUpdate() },
  onConsent: () => { pushConsentUpdate() },
  onChange: () => { pushConsentUpdate() },
})
```

Build the translations object for every locale the layout passes in, not only the active one, so `autoDetect` can find a match. Escape label text before it is placed in an HTML string. The library treats `description` as HTML. A label from the CMS is text:

```ts
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
```

`respectGpc` keeps categories that were marked `enabled` from running before a choice, and the library then lets an explicit choice override the signal. The `ad_*` signals still have to stay denied, which is the next function's job.

The `_ga` / `_gid` names are the ones in the library's Consent Mode example. Add a marketing cookie name only when a real marketing tool sets it.

## Update and GPC

```ts
type ConsentState = 'granted' | 'denied'

function gpcRejectsMarketing(): boolean {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true
}

function pushConsentUpdate(): void {
  const analytics = CookieConsent.acceptedCategory('analytics')
  const marketing = CookieConsent.acceptedCategory('marketing') && !gpcRejectsMarketing()
  const state = (on: boolean): ConsentState => (on ? 'granted' : 'denied')

  window.gtag?.('consent', 'update', {
    analytics_storage: state(analytics),
    ad_storage: state(Boolean(marketing)),
    ad_user_data: state(Boolean(marketing)),
    ad_personalization: state(Boolean(marketing)),
  })
}
```

Declare `Navigator.globalPrivacyControl?: boolean` and `Window.gtag` in this module. `acceptedCategory` stays false until `run` has read a stored choice, which is why the update runs from the three callbacks and not during render.

After `pushConsentUpdate`, set React state that mounts the tag. Analytics mounts only when the category is granted and `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. Marketing mounts only when its signals are granted and `PROJECT.md` names a marketing tool. With no tool, the category is still in the banner and loads nothing.

Load the tag with `next/script` and `strategy="afterInteractive"`:

```tsx
<Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
```

Then `gtag('config', measurementId)`. The config call happens after the update, so the first hit is consented. The install URL is the gtag.js snippet from [the Google tag install guide](https://developers.google.com/tag-platform/gtagjs/install). Copy the current snippet from that page if the path differs, and keep it behind this gate.

Advanced mode (tag present on first paint, cookieless pings while denied) is a client decision. It fails the "no analytics request before consent" check. Do not enable it unless they accept that in writing.

## Footer control

```tsx
<button type="button" data-cc="show-preferencesModal">
  {label}
</button>
```

`label` is a message key, for example `footer.cookieSettings` = `Cookie settings`. The attribute is the documented trigger and works after `run`.

## Checks

1. Hard-reload, touch nothing. Network filter `google`. There should be no tag request. Console: `dataLayer` includes the default command with four `denied` values.
2. Accept analytics only. `analytics_storage` becomes `granted`. The three `ad_*` values stay `denied`. The tag request appears after that.
3. Reject all. No tag request. A later reload stays rejected (`revision` unchanged).
4. Firefox with "Tell websites not to sell or share my data", or Brave with Global Privacy Control. Accept all. The three `ad_*` values stay `denied`.
5. Open `/ar/`. The banner follows the document direction. `language.rtl` is what turns the dialog RTL; the page `dir` attribute alone does not restyle the dialog.
