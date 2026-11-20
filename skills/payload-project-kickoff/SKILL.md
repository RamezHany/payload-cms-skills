---
name: payload-project-kickoff
description: Entry point for every Payload CMS + Next.js website session. Use at the start of any task on a Payload project, when starting a new site from a brief or Figma link, when adding a backend to an existing frontend, or when unsure which skill applies. Loads guardrails, reads PROJECT.md, detects the scenario, writes a phased plan, and routes each phase to the right skill.
license: MIT
metadata:
  version: "1.1.0"
---

# Payload project kickoff

Run this skill first in every session. It costs a few file reads and prevents rebuilding work that already exists.

## Step 1: Load the rules

1. Load the `agent-guardrails` skill and follow it for the whole session.
2. Read `PROJECT.md` at the repository root.
   - If it is missing, copy [assets/PROJECT.template.md](assets/PROJECT.template.md) to `PROJECT.md`. Fill in only what the brief states. Write `TBD` for anything unknown. Never invent client names, prices, addresses, or legal text.
3. Read `AGENTS.md` at the root if it exists. If it does not exist, copy [assets/AGENTS.template.md](assets/AGENTS.template.md) to `AGENTS.md`.
4. If `PROJECT.md` has a `## Session log`, read the last entry and continue from its "Next step".

## Step 2: Detect the scenario

Read `package.json` and list the top-level folders. Do not install anything to detect the scenario.

| Signal | Scenario | First skill |
| --- | --- | --- |
| Empty folder, or no `package.json` | A. New site | `payload-bootstrap` |
| Next.js app, no `payload` dependency | B. Backend for an existing frontend | `project-architecture` (refactor first), then `payload-bootstrap` |
| Vite, Create React App, or Lovable export (no `next` dependency) | C. Migrate to Next.js, then add the backend | `project-architecture` (migration playbook) |
| `payload` dependency present | D. Feature or fix | The feature skill from the routing table |
| Brief includes a Figma link | Frontend from design | `figma-handoff`, then scenario A or B |

Record the scenario in `PROJECT.md` under `## Scenario`.

## Step 3: Make sure the official Payload skill is installed

Payload maintains an official skill that documents the full API (collections, fields, hooks, access control, queries). These skills cover stack decisions and flows on top of it. Read the official skill whenever you need API details; do not guess field options or hook signatures.

1. Check for `.agents/skills/payload/SKILL.md` or `.claude/skills/payload/SKILL.md`.
2. If missing:
   - Scenario A: `payload-bootstrap` installs it through `create-payload-app --agent`.
   - Scenarios B, C, D: run `npx degit payloadcms/payload/tools/claude-plugin/skills/payload#3.x .agents/skills/payload`
3. The `3.x` branch matches Payload 3. Never install the skill from the default branch; it documents Payload 4.

## Step 4: Write the phased plan

Write the plan into `PROJECT.md` under `## Phases` as a checklist. Use only the phases the brief needs, in this order.

When the brief has a Figma URL, add a Design handoff line before phase 1 (`figma-handoff`). When the design needs motion, 3D, or a copied component, add a Creative frontend line next (`creative-frontend`). The numbered phases stay in this order:

1. Architecture: folder layout, refactor an existing frontend (`project-architecture`)
2. Bootstrap and data model (`payload-bootstrap`)
3. Admin: roles, branding, languages (`payload-auth-rbac`, `payload-admin-branding`, `payload-localization`)
4. Content: live preview, media, SEO and GEO, legal pages (`payload-live-preview`, `payload-media`, `payload-seo-geo`, `payload-legal-trust`)
5. Business flows: forms, bookings, payments, integrations, MCP (`payload-forms-crm`, `payload-bookings-payments`, `payload-integrations`, `payload-mcp`)
6. Performance (`payload-performance`)
7. Testing (`payload-testing`)
8. Deploy (`payload-deploy-vercel`)

Each phase line names its skill and a one-line "Done when". Work on one phase at a time. Smaller models should finish one phase per session.

## Step 5: Route tasks to skills

| Task | Skill |
| --- | --- |
| New project, install Payload, data model | `payload-bootstrap` |
| Folder layout, refactor, migrate from Vite or Lovable | `project-architecture` |
| Figma file, frames, design handoff | `figma-handoff` |
| GSAP, Lenis, Motion, 3D, Rive, or a copied free component | `creative-frontend` |
| Admin colors, logo, sidebar, dashboard | `payload-admin-branding` |
| Multiple languages, RTL, translated admin | `payload-localization` |
| Live preview, drafts, preview button | `payload-live-preview` |
| Images, video, files, uploads | `payload-media` |
| Metadata, sitemap, JSON-LD, `llms.txt`, AI links | `payload-seo-geo` |
| Privacy, terms, cookies, trust page, GDPR | `payload-legal-trust` |
| Contact forms, leads, CRM, CSV export | `payload-forms-crm` |
| Booking, payments, calendar, confirmations | `payload-bookings-payments` |
| Email, Google Sheets, Drive, Search Console, spam protection | `payload-integrations` |
| MCP server for the client | `payload-mcp` |
| Users, roles, permissions | `payload-auth-rbac` |
| Speed, caching, bundles | `payload-performance` |
| Tests, saves failing, preview broken | `payload-testing` |
| Deploy, env vars, migrations, cron | `payload-deploy-vercel` |

## Fixed stack

Do not substitute any of these unless `PROJECT.md` records the client's approval.

| Concern | Choice | Skill |
| --- | --- | --- |
| Framework | Next.js latest stable (App Router) + Payload 3.x | `payload-bootstrap` |
| Database | libSQL / Turso with `@payloadcms/db-sqlite` | `payload-bootstrap` |
| Hosting | Vercel, Hobby limits respected | `payload-deploy-vercel` |
| Images | Cloudinary or Cloudflare R2, direct browser upload | `payload-media` |
| Video | Mux; Vimeo or unlisted YouTube as alternatives | `payload-media` |
| Email | Resend; Mailgun over SMTP as alternative | `payload-integrations` |
| Styling | Tailwind CSS | `project-architecture` |

## Coding rules for every phase

- TypeScript strict. No `any` in new code.
- Server data: React Server Components with the Payload Local API.
- Client data: TanStack Query. Never `useEffect` + `fetch` for data.
- Forms: React Hook Form + Zod through `@hookform/resolvers/zod`. Use Zod's built-in validators (`z.email()`, `z.url()`, `z.e164()`); never hand-written regex.
- shadcn/ui is never the base design system. The shadcn CLI may fetch one specific registry component only when `PROJECT.md` lists it.
- Install the latest stable version of each package: check with `pnpm view <package> version` before adding it.
- Package manager: pnpm.
- Full conventions: `project-architecture` skill.

## Model roles

When several models share a project, assign roles as described in [references/model-roles.md](references/model-roles.md).

## Done when

- [ ] `PROJECT.md` exists, with the scenario and phases filled in
- [ ] `AGENTS.md` exists at the root
- [ ] The official Payload skill is installed from the `3.x` branch
- [ ] The current phase and its skill are named in `PROJECT.md`
