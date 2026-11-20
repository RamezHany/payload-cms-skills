---
name: payload-admin-branding
description: Brand the Payload CMS 3 admin panel to match the website with minimal, upgrade-safe changes - logo and icon graphics, favicon and title, fonts, radius, accent color, sidebar (nav) styling, and a simple dashboard welcome block, all through documented CSS variables and component slots. Use when the client wants the admin to look like their brand, when designing or restyling the admin, or before creating any custom admin view.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload admin branding

Goal: the admin feels like the client's product while staying stock Payload underneath. Every change here survives Payload upgrades because it uses documented variables and component slots only.

Before designing or styling, read [references/admin-anatomy.md](references/admin-anatomy.md). It describes the admin's regions and which parts may change.

## Customization tiers

| Tier | What | Risk | Use |
| --- | --- | --- | --- |
| 1 | CSS variables in `custom.scss` (fonts, radius, colors) | None | Always |
| 2 | Graphics (`Logo`, `Icon`), meta, component slots (`beforeDashboard`, `beforeLogin`) | Low | Always |
| 3 | Styling documented nav classes (`.nav`, `.nav__link`) | Low | Sidebar brand colors |
| 4 | Custom field components, custom cells | Medium | Only when a field needs special input |
| 5 | Replacing views (dashboard, list, edit) | High | Only if `PROJECT.md` requires it |

Stay in tiers 1 to 3 unless the brief says otherwise.

## Step 1: Brand assets

1. Put `logo.svg` and `icon.svg` in `public/brand/`.
2. Create `src/components/admin/Logo.tsx` and `src/components/admin/Icon.tsx`. Each renders a plain `<img>` (Server Component, no `'use client'`) with explicit `width`, `height`, and `alt`.
3. Register them in `src/payload.config.ts`:

```ts
admin: {
  components: {
    graphics: {
      Logo: '@/components/admin/Logo#Logo',
      Icon: '@/components/admin/Icon#Icon',
    },
  },
  meta: {
    titleSuffix: '- Client Name',
    icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/brand/icon.svg' }],
  },
},
```

4. Run `pnpm generate:importmap`.

`Logo` appears on the login screen. `Icon` appears in the nav.

## Step 2: Theme and tokens

1. Set `admin.theme` to `'light'`, `'dark'`, or `'all'` (default, lets each user choose). Pick the one that matches the frontend; `'all'` requires checking both themes.
2. Copy [assets/custom.scss](assets/custom.scss) to `src/app/(payload)/custom.scss` (the template file is empty).
3. Replace the brand values at the top with the colors and fonts from `PROJECT.md`.

Payload 3 wraps its own styles in the `payload-default` cascade layer, so rules in `custom.scss` win without `!important`. Never add `!important`.

Verified Payload 3 variables you may set:

| Variable | Controls |
| --- | --- |
| `--font-body`, `--font-mono`, `--font-serif` | Admin typefaces |
| `--style-radius-s`, `--style-radius-m`, `--style-radius-l` | Corner radius |
| `--theme-bg`, `--theme-text`, `--theme-input-bg` | Page background, text, inputs |
| `--theme-elevation-0` to `--theme-elevation-1000` | Neutral surface scale (step 50) |
| `--theme-success-*`, `--theme-warning-*`, `--theme-error-*` | Status colors (step 50) |
| `--nav-width` | Sidebar width |
| `--bg-color`, `--color`, `--hover-bg`, `--hover-color` on `.btn--style-primary` | Primary button colors |

If you change the neutral scale, change all 21 steps together for each theme; partial overrides produce unreadable contrast.

## Step 3: Sidebar

Brand the sidebar with the documented nav classes only (`.nav`, `.nav__scroll`, `.nav__link`, `.nav__link-indicator`, `.nav__controls`). The asset file includes a minimal version: brand background, readable link color, and the accent color on the active-link indicator. Do not change nav layout, widths per breakpoint, or collapse behavior.

## Step 4: Fonts

Self-host the brand font so the admin does not depend on a third-party request:

1. Put `woff2` files in `public/fonts/`.
2. Declare them with `@font-face` at the top of `custom.scss` (the asset shows the pattern).
3. Point `--font-body` at the family with a system fallback.

For Arabic admin users, include a font with Arabic glyphs in the same stack.

## Step 5: Dashboard welcome block

Replace the template's `BeforeDashboard` seed component with a short welcome block for the client:

- Client logo, one line of greeting, and three to five quick links (new post, view leads, bookings today, site settings).
- Server Component. Data such as "new leads this week" comes from the Payload Local API with `overrideAccess: false` and the current user.
- Register it in `admin.components.beforeDashboard`.

## Step 6: Organize the sidebar

1. Group collections with `admin.group` (`Content`, `Leads & Bookings`, `Media`, `Settings`).
2. Hide technical collections from non-admins with `admin.hidden: ({ user }) => user?.role !== 'admin'` (`payment-events`, `redirects`, `search`).
3. Order collections in `buildConfig` by how often editors use them.

## Stop and ask

- The brief asks for a custom dashboard, custom list view, or a layout different from Payload's.
- Brand colors fail contrast (text on the nav background below 4.5:1). Propose an adjusted shade instead of shipping it.

## Done when

- [ ] Logo on login, icon in nav, favicon and title suffix set
- [ ] `custom.scss` sets brand font, radius, accent, and nav colors without `!important`
- [ ] Every admin screen (login, dashboard, list, edit, live preview, account) is readable in the configured theme or themes
- [ ] Text contrast is at least 4.5:1 on nav and buttons
- [ ] No Payload view is replaced unless `PROJECT.md` requires it
