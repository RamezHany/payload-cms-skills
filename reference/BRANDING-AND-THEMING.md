# Custom Branding, Contrast-Safe Theme & Table Styling

Complete guide to aligning the Payload CMS Admin Panel with the client's frontend brand identity, replacing the default Payload logo/icon, styling list tables, and enforcing strict WCAG AA/AAA color contrast rules so light text is never placed on a light background (and dark text is never placed on a dark background).

## 1. Custom Client Logo & Favicon (`src/components/admin/BrandGraphics.tsx`)

Automatically inspect the frontend project (`public/` or `src/assets/`) for the client's logo and favicon. Reference them in `payload.config.ts`:

```tsx
// src/components/admin/Logo.tsx
import React from 'react'

export const BrandLogo: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img
        src="/logo.svg"
        alt="Brand Logo"
        style={{ maxHeight: '44px', width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
export default BrandLogo
```

```tsx
// src/components/admin/Icon.tsx
import React from 'react'

export const BrandIcon: React.FC = () => {
  return (
    <img
      src="/logo-icon.svg"
      alt="Brand Icon"
      style={{ width: '28px', height: '28px', objectFit: 'contain' }}
    />
  )
}
export default BrandIcon
```

Configure in `src/payload.config.ts`:

```ts
admin: {
  meta: {
    titleSuffix: `— ${process.env.NEXT_PUBLIC_SITE_NAME || 'Admin Portal'}`,
    icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/favicon.svg' }],
  },
  components: {
    graphics: {
      Logo: '/components/admin/Logo',
      Icon: '/components/admin/Icon',
    },
    header: ['/components/admin/ForcePasswordChangeGate'],
    afterLogin: ['/components/admin/OtpPasswordResetModal'],
  },
}
```

## 2. Strict Contrast Rule & Theme Customization (`src/app/(payload)/custom.scss`)

### CRITICAL CONTRAST GUARDRAIL

When extracting brand colors from the frontend (`tailwind.config.*` or `globals.css`):

1. **Never place light-on-light or dark-on-dark**: Every surface background (`--theme-bg`, `--theme-elevation-50`, `--theme-elevation-100`, `--theme-input-bg`, button backgrounds, badge pills) and its foreground text MUST maintain a minimum contrast ratio of **4.5:1** (WCAG AA).
2. **Button Text Contrast**: If the client's primary brand color is bright/light (e.g., yellow, lime, cyan, pastel, light gold where relative luminance `L > 0.45`), button text on `--brand-primary` MUST be dark (`#0f172a`), NEVER `#ffffff`. If the brand primary is dark (`L <= 0.45`), button text MUST be `#ffffff`.
3. **Separate Light and Dark Mode Tokens**: Explicitly scope light variables to `:root` / `[data-theme="light"]` and dark variables to `[data-theme="dark"]` so switching themes in Payload Admin never produces unreadable low-contrast text.

### Production `custom.scss` Template (Brand-Matched + Modern Table UI)

```scss
/* src/app/(payload)/custom.scss */

:root,
[data-theme='light'] {
  /* Replace --brand-primary with the client's main dark-safe accent color */
  --brand-primary: #2563eb;
  --brand-primary-hover: #1d4ed8;
  --brand-primary-foreground: #ffffff; /* Use #0f172a if --brand-primary is a light color! */

  --theme-bg: #f8fafc;
  --theme-input-bg: #ffffff;
  --theme-text: #0f172a;
  --theme-elevation-0: #ffffff;
  --theme-elevation-50: #f8fafc;
  --theme-elevation-100: #f1f5f9;
  --theme-elevation-150: #e2e8f0;
  --theme-elevation-200: #cbd5e1;
  --theme-elevation-250: #94a3b8;
  --theme-elevation-300: #64748b;
  --theme-elevation-400: #475569;
  --theme-elevation-500: #334155;
  --theme-elevation-800: #1e293b;
  --theme-elevation-1000: #0f172a;
}

[data-theme='dark'] {
  --brand-primary: #3b82f6;
  --brand-primary-hover: #60a5fa;
  --brand-primary-foreground: #ffffff;

  --theme-bg: #0b0f19;
  --theme-input-bg: #111827;
  --theme-text: #f8fafc;
  --theme-elevation-0: #0b0f19;
  --theme-elevation-50: #111827;
  --theme-elevation-100: #1e293b;
  --theme-elevation-150: #26334d;
  --theme-elevation-200: #334155;
  --theme-elevation-250: #475569;
  --theme-elevation-300: #64748b;
  --theme-elevation-400: #94a3b8;
  --theme-elevation-500: #cbd5e1;
  --theme-elevation-800: #f1f5f9;
  --theme-elevation-1000: #ffffff;
}

/* Primary Buttons with Guaranteed Foreground Contrast */
.btn--style-primary {
  background-color: var(--brand-primary) !important;
  color: var(--brand-primary-foreground) !important;
  border-color: var(--brand-primary) !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  transition: background-color 0.15s ease, transform 0.1s ease !important;

  &:hover:not(:disabled) {
    background-color: var(--brand-primary-hover) !important;
    color: var(--brand-primary-foreground) !important;
  }
}

/* Clean, Modern List View Tables (Forms, Submissions, Collections) */
.table {
  width: 100%;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  background: var(--theme-elevation-0) !important;
  border: 1px solid var(--theme-elevation-150) !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;

  thead tr th {
    background-color: var(--theme-elevation-100) !important;
    color: var(--theme-text) !important;
    font-weight: 700 !important;
    font-size: 13px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.03em !important;
    padding: 14px 16px !important;
    border-bottom: 1px solid var(--theme-elevation-200) !important;
  }

  tbody tr {
    transition: background-color 0.12s ease !important;

    &:nth-child(even) {
      background-color: var(--theme-elevation-50) !important;
    }

    &:hover {
      background-color: var(--theme-elevation-100) !important;
    }

    td {
      padding: 14px 16px !important;
      color: var(--theme-text) !important;
      border-bottom: 1px solid var(--theme-elevation-100) !important;
      vertical-align: middle !important;
      font-size: 14px !important;
    }
  }
}

/* Hide any residual API URL badges or links via CSS fallback */
.doc-controls__meta-api-url,
a[href*='/api/']:not(.export-csv-btn) {
  display: none !important;
}
```
