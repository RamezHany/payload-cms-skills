# Payload CMS Skills

Agent Skills that make coding agents build **Payload CMS 3 + Next.js** websites the same way every time: started from the official template, with working live preview and saves, uploads that go straight from the browser, and guardrails for unattended runs.

The skills follow the open [Agent Skills](https://agentskills.io) format. They work in Cursor, Claude Code, Codex, OpenCode, Gemini CLI, and any other agent that reads `SKILL.md` files, regardless of which model runs them.

## Why this exists

Generic agents building Payload sites tend to:

- scaffold from scratch instead of using the official template, then drift from Payload conventions
- implement live preview client-side only, which breaks drafts, locales, and caching
- fail saves on SQLite or in production because of transaction settings, missing migrations, or uploads that pass through a 4.5 MB serverless body limit
- loop for hours in unattended mode, rerun the same failing command, and write throwaway scripts that wander the machine

Each skill here is a short, ordered procedure with explicit file paths, verified snippets, decision tables, and a "Done when" checklist. Agents load only the skills a task needs, which keeps token use low.

## Install

```bash
npx skills add RamezHany/payload-cms-skills
```

This installs every skill into the agent folders you pick. To install a single skill:

```bash
npx skills add RamezHany/payload-cms-skills --skill payload-live-preview
```

Manual install and per-tool paths are in [docs/INSTALL.md](docs/INSTALL.md).

## Use

Open the project and tell your agent:

> Use the `payload-project-kickoff` skill. The brief is in PROJECT.md.

The kickoff skill loads the guardrails, detects the scenario (new site, backend for an existing frontend, feature, or fix), writes a phased plan into `PROJECT.md`, and routes each phase to the right skill.

## Skills

| Skill | Use it for |
| --- | --- |
| [payload-project-kickoff](skills/payload-project-kickoff/SKILL.md) | Entry point: reads the brief, detects the scenario, plans phases, routes to skills |
| [agent-guardrails](skills/agent-guardrails/SKILL.md) | Hard rules for scope, shell use, loop breaking, secrets, and unattended runs |
| [project-architecture](skills/project-architecture/SKILL.md) | Canonical folder layout, code conventions, refactor-first playbook for existing frontends |
| [payload-bootstrap](skills/payload-bootstrap/SKILL.md) | New project from the official template, or Payload added to an existing Next.js app |
| [payload-admin-branding](skills/payload-admin-branding/SKILL.md) | Admin panel that matches the site brand with minimal, upgrade-safe CSS |
| [payload-localization](skills/payload-localization/SKILL.md) | Content locales, RTL, admin language that follows the content locale, localized routes |
| [payload-live-preview](skills/payload-live-preview/SKILL.md) | Server-side live preview with drafts, autosave, locales, and cache bypass |
| [payload-media](skills/payload-media/SKILL.md) | Direct browser uploads (Cloudinary, R2, S3), in-browser WebP optimization, Mux video |
| [payload-seo-geo](skills/payload-seo-geo/SKILL.md) | SEO, AEO, GEO: metadata, JSON-LD, sitemap, `/llms.txt`, Summarize with AI links |
| [payload-legal-trust](skills/payload-legal-trust/SKILL.md) | Admin-editable policy pages, trust center, cookie consent, GDPR badge |
| [payload-forms-crm](skills/payload-forms-crm/SKILL.md) | Frontend forms (React Hook Form + Zod), leads collection, simple CRM, CSV export |
| [payload-bookings-payments](skills/payload-bookings-payments/SKILL.md) | Consultation booking with Paymob, Kashier, Fawry, Stripe, PayPal, or Tap, plus Google Calendar |
| [payload-integrations](skills/payload-integrations/SKILL.md) | Resend, Mailgun, Google Sheets, Drive, Search Console, Turnstile |
| [payload-mcp](skills/payload-mcp/SKILL.md) | Optional MCP endpoint tuned for Vercel limits |
| [payload-auth-rbac](skills/payload-auth-rbac/SKILL.md) | Multiple admins, roles, field-level access, safe defaults |
| [payload-performance](skills/payload-performance/SKILL.md) | Caching and revalidation, bundle size, images, lazy loading, Core Web Vitals |
| [payload-testing](skills/payload-testing/SKILL.md) | Save-and-persist tests, live preview tests, save-failure diagnosis |
| [payload-deploy-vercel](skills/payload-deploy-vercel/SKILL.md) | Vercel Hobby limits, migrations in CI, env vars, cron, Turso |

These skills sit on top of the **official Payload skill**, which covers the full Payload API. The kickoff skill makes sure it is installed in the project, version-matched to Payload 3.

## Default stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (latest stable, App Router) + Payload 3.x + Tailwind CSS |
| Database | libSQL / Turso through `@payloadcms/db-sqlite` |
| Hosting | Vercel (Hobby limits respected) |
| Images | Cloudinary, or Cloudflare R2 / S3, uploaded directly from the browser |
| Video | Mux (alternatives: Vimeo, unlisted YouTube) |
| Email | Resend, or Mailgun over SMTP |
| Client data | TanStack Query |
| Forms | React Hook Form + Zod |
| Payments | Paymob, Kashier, Fawry, Stripe, PayPal, Tap |

Exact verified versions live in [versions.json](versions.json). A weekly workflow opens an issue when upstream versions drift.

## Mixing models

The skills are written so that smaller and cheaper models can follow them step by step. A setup that works well:

| Role | Example models |
| --- | --- |
| Design in Figma | Muse, Gemini |
| Build features | Gemini, Claude, Grok |
| Small scoped tasks | DeepSeek, Xiaomi MiMo, OpenCode Big Pickle |
| Review | Claude, Opus |

See [skills/payload-project-kickoff/references/model-roles.md](skills/payload-project-kickoff/references/model-roles.md).

## Repository layout

```text
skills/            one folder per skill (SKILL.md + references/ + assets/)
scripts/           validator and upstream version check (no dependencies)
docs/              architecture, install, roadmap, versions
.github/           CI workflows, issue and pull request templates
versions.json      verified package versions
```

## Roadmap

Figma design and handoff skills, creative frontend skills, and a static Project Pack generator are planned. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; run `npm run validate` before opening a pull request.

## License

[MIT](LICENSE). The official Payload skill that projects install separately is MIT-licensed by Payload CMS, Inc.
