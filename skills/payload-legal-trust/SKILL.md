---
name: payload-legal-trust
description: Legal pages, a trust center, cookie consent, and a GDPR badge for Payload CMS 3 sites. Policy outlines only, vanilla-cookieconsent with Google Consent Mode v2, Global Privacy Control, and RTL. Use when adding privacy, terms, cookies, refunds, accessibility, a consent banner, subprocessors, or a compliance badge.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload legal and trust

Produces draft legal pages, a trust-center page, a cookie banner, and an optional badge. It does not produce legal text. The client or their lawyer supplies every sentence that states a right, a fee, a retention period, or a compliance claim.

## Step 1: Legal pages

Add `legal-pages` as in [references/policy-outlines.md](references/policy-outlines.md).

Fields: localized `title`, localized `summary` (one line for `/llms.txt`), `slug`, localized rich text `body`, `effectiveDate`, `lastUpdated`, `version`. Slug stays shared across locales. Drafts use autosave and live preview with the `/legal` prefix from the `payload-live-preview` skill.

Create unpublished drafts for the pages `PROJECT.md` needs, with title and slug only. Required body, dates, and version are filled when the text arrives. Payload skips required-field checks on drafts.

| Slug | Page | Create it when |
| --- | --- | --- |
| `privacy` | Privacy policy | Always |
| `terms` | Terms of service | Always |
| `cookies` | Cookie policy | Always, once the banner exists |
| `refunds` | Refund and cancellation | The site takes payment or bookings |
| `accessibility` | Accessibility statement | The client wants one. Do not claim a WCAG level they did not name |

The route is `src/app/(frontend)/[locale]/legal/[slug]/page.tsx`. Follow the page shape in the `payload-live-preview` skill. Render a visible line with the effective date, the last updated date, and the version, using `Intl.DateTimeFormat` and labels from `messages/en.json`. Ask the client for the Arabic strings.

Wire `revalidateOnPublish` and `revalidateOnDelete` from the `payload-performance` skill. The targets function is in [references/policy-outlines.md](references/policy-outlines.md), and the map row is below.

## Step 2: Policy outlines

[references/policy-outlines.md](references/policy-outlines.md) lists the headings and the facts to collect. [references/jurisdiction-checklists.md](references/jurisdiction-checklists.md) is a question list for counsel about Egypt, the GDPR, and the Gulf. Paste answers into `PROJECT.md`. Do not paste them into the page as if they were the policy.

Stop after the drafts exist until the text is in hand. An empty published policy is worse than no page.

## Step 3: Trust center

Use a `trust-center` global, not a block on site-settings. Site-settings renders in the layout, so a subprocessors edit would regenerate every route. The trust page is one route.

Fields, seed list, and the page: [references/trust-center.md](references/trust-center.md). Route: `src/app/(frontend)/[locale]/trust/page.tsx`.

Prefill a row only for a provider `PROJECT.md` enables. Open the privacy or DPA link and keep it only when that page loads. Data location is the region in `PROJECT.md` (Vercel region, Turso region). Leave it blank and ask when the region was not chosen. Do not write a certification the project does not hold.

## Step 4: Cookie consent

`vanilla-cookieconsent` 3.3.0. Client component `src/components/ConsentBanner.tsx`, mounted once in `src/app/(frontend)/[locale]/layout.tsx`. Categories: `necessary` (read-only), `analytics`, `marketing`. Copy and the Consent Mode wiring: [references/consent.md](references/consent.md).

Texts come from the `consent-settings` global, localized. That global renders in the layout, so its hook expires `global_consent-settings` with the justification comment in the reference.

- `language.rtl` includes every code in `rtlLocales`, so Arabic lays out right to left.
- `revision` starts at 1. Raising it shows the banner again. `0` disables that behavior in this library.
- Set Google Consent Mode v2 defaults to denied in a `beforeInteractive` script in the locale layout, before any Google tag. The four signals are `ad_storage`, `ad_user_data`, `ad_personalization`, and `analytics_storage`.
- On accept, change, or reject, call `gtag('consent', 'update', ...)`.
- Load analytics and marketing scripts only after that update, and only for a granted category. This is the gate the `payload-performance` skill Step 8 expects. Basic mode: no tag request before a choice.
- When `navigator.globalPrivacyControl === true`, keep the three `ad_*` signals denied even if the visitor clicks accept all. Also set the library's `respectGpc: true`.
- The footer includes a button with `data-cc="show-preferencesModal"`.

Ask for banner sentences the same way as legal pages. Do not ship placeholder consent copy.

## Step 5: GDPR badge

Render the badge only when `site-settings.gdprBadgeEnabled` is true and `gdprBadgeLabel` is non-empty for that locale. The checkbox and the label are defined by the `payload-seo-geo` skill. Default is off.

The label is the client's sentence. Do not substitute "GDPR compliant", a seal, or a flag. An enabled checkbox with an empty label renders nothing.

## Step 6: Footer

Add footer links to each published legal page and to `/trust` as entries on the footer global, which the editor controls. Do not query `legal-pages` inside the layout. A layout query tagged with the collection would regenerate every route on each policy publish.

The cookie-settings button and the badge sit in the footer component. The badge reads site-settings through `getSiteSettings`.

## Invalidation map

Use the `PROJECT.md` cell form from the `payload-testing` skill, under the single line `Locales: en, ar`. `/llms.txt` is included because the `payload-seo-geo` skill lists published legal pages there. Add `/llms-full.txt` only when that route exists. The legal-pages fixture slug is `trace-legal`.

| Collection or global | Trigger | Paths | Tags | Writes per save |
| --- | --- | --- | --- | --- |
| legal-pages | publish | `/<locale>/legal/<slug>`, `/llms.txt` | `legal-pages:<slug>`, `legal-pages-sitemap` | 1 x locales + 1 |
| trust-center | update | `/<locale>/trust` | `pages-sitemap` | 1 x locales |
| consent-settings | update | layout | `global_consent-settings` | all routes x locales, rare, accepted |

These cells are the `PROJECT.md` form from the `payload-testing` skill. `layout` means the global tag only.

The trust-center hook does not use a layout tag. The consent hook does not call `revalidatePath` with `'layout'`. The comment in each hook names the reason.

## Environment

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

Optional. When it is empty, the analytics category grants nothing and loads no script. If `PROJECT.md` already names a measurement-id variable, use that name and do not add a second one. No secret belongs in this skill. The verification token and the badge live in the CMS.

## Stop and ask

- Any policy sentence, retention period, fee, governing law, or complaint authority.
- Whether a refund page should exist.
- The WCAG level, if they want it stated at all.
- Banner title, descriptions, and button labels in each locale.
- Subprocessor data locations that `PROJECT.md` does not already record.
- Turning the GDPR badge on, and the sentence it should show.
- A request for advanced Consent Mode (Google tags load before a choice and send cookieless pings). That fails the network check below. Ship basic mode unless they accept that trade in writing.

## Done when

- [ ] Before any consent click, the Network panel shows no request to `googletagmanager.com`, `google-analytics.com`, or `googleadservices.com`
- [ ] `dataLayer` contains `consent` / `default` with all four signals `denied` before the click, and `consent` / `update` after a choice
- [ ] With Global Privacy Control on, accept-all still leaves `ad_storage`, `ad_user_data`, and `ad_personalization` denied
- [ ] The footer button reopens preferences
- [ ] On `/ar/...`, the banner layout is RTL
- [ ] `/en/legal/privacy` and `/ar/legal/privacy` render the matching locale, and the effective date, updated date, and version are visible
- [ ] Raising `consent-settings.revision` shows the banner again in a browser that had already chosen
- [ ] A published legal page's log line lists `/<locale>/legal/<slug>` and `/llms.txt` only, plus the legal sitemap tag

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Analytics request on first paint | Tag or `GoogleAnalytics` mounted in the layout | Consent reference: load it after `update` |
| Banner stays LTR in Arabic | `language.rtl` omits `ar` | Consent reference |
| Preferences button does nothing | Banner script not mounted, or the attribute is wrong | `data-cc="show-preferencesModal"` |
| Badge visible on a new site | Checkbox defaulted on, or the label is hardcoded | Step 5 |
| Preview of a policy 404s | Prefix map | `payload-live-preview`, prefix `/legal` |
| Saving the banner text does not refresh pages | Hook missing the global tag | Consent reference |
