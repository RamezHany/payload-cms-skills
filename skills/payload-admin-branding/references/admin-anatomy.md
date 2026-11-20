# Payload 3 admin anatomy

Use this map when designing the admin in Figma or styling it in code. Design inside these regions; do not invent a different dashboard layout. Payload renders all of this; branding changes tokens, graphics, and slot content.

## Shell

| Region | What it contains | Brandable through |
| --- | --- | --- |
| Nav (left sidebar; right in RTL) | Icon, collection and global links grouped by `admin.group`, logout | `.nav*` classes, `--nav-width`, `Icon` graphic, `beforeNavLinks` / `afterNavLinks` slots |
| App header (top bar) | Breadcrumbs (step nav), locale selector, account avatar | Tokens only |
| Main content | The current view | Tokens, view slots |

Height and spacing variables: `--app-header-height`, `--doc-controls-height`, `--gutter-h`, `--base`.

## Views

| View | Layout | Slots and customization points |
| --- | --- | --- |
| Login | Centered card with the `Logo` graphic, email and password | `graphics.Logo`, `beforeLogin`, `afterLogin` |
| Dashboard | Cards for each collection and global, grouped | `beforeDashboard`, `afterDashboard` |
| List | Title, create button, search, filters, columns picker, table, pagination, bulk actions | `admin.defaultColumns`, field `admin.components.Cell`, `beforeList`, `beforeListTable`, `afterListTable`, `afterList` |
| Edit | Document controls bar (save draft, publish, preview, live preview toggle, status), main fields column, sidebar fields (`admin.position: 'sidebar'`), tabs | Field components, `beforeDocumentControls`, `edit.Upload` for uploads |
| Live preview | Split view: fields on one side, iframe on the other, breakpoint selector | `admin.livePreview.breakpoints` |
| Versions | Version list and diff view | Tokens only |
| Account | User fields, language picker, theme picker | Tokens only |

## Field anatomy

Each field renders: label, optional description, input, error message. Layout fields (`row`, `tabs`, `collapsible`, `group`) arrange them. Use `admin.width` on fields inside a `row` for side-by-side inputs. Use `admin.description` for editor guidance instead of custom help components.

## Design rules for the admin

1. Brand: logo, icon, accent color, nav colors, typography, radius, dashboard welcome block, login message.
2. Keep: navigation structure, list tables, edit layout, document controls, live preview split.
3. Contrast: body text and nav links at least 4.5:1 against their backgrounds, in every enabled theme.
4. RTL: the nav moves to the right and the layout mirrors automatically for RTL admin languages. Do not design a separate RTL layout; check that icons and the logo still work mirrored.
5. Density: Payload's spacing scale is based on `--base`. Do not redesign spacing per component.
6. States: design hover, focus-visible, active (current page), and disabled states for nav links and primary buttons only. Everything else inherits.

## What a design handoff for the admin contains

- Brand tokens: accent, accent hover, accent contrast, nav background, nav text, nav muted text, font family, radius small, medium, and large.
- Logo (wide) and icon (square) as SVG.
- Dashboard welcome block: content and quick links.
- Collection groups and their order.
- Screenshots of the login, dashboard, list, and edit views with tokens applied, in each enabled theme.
