# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.2.1] - 2026-11-20

### Changed

- README, the Pages site, and the roadmap say Design, Creative, and phases 1 through 8 are written. Payload 4 is the remaining library work. A client project still starts those phases unchecked.

## [1.2.0] - 2026-11-20

### Added

- Static documentation site in `docs/index.html` for GitHub Pages. The phase list is the main section. The published URL is `https://ramezhany.github.io/payload-cms-skills/`.

## [1.1.0] - 2026-11-20

### Added

- README phase table for the kickoff order, including design handoff and creative frontend when the brief needs them.
- `figma-handoff` and `creative-frontend` skills. Free libraries only, with a license record checked on 2026-11-20. Paid and Pro components stay out. recent.design stays blocked until its page states a license.
- Static Project Pack page that downloads `PROJECT.md`, `AGENTS.md`, and the skills install command.
- Stdio MCP server (`scripts/library-mcp.mjs`) that lists skills and reads one skill or one reference file.

## [1.0.0] - 2026-11-20

### Added

- Focused skills in the Agent Skills format under `skills/`, replacing the single `SKILL.md`.
- `payload-project-kickoff` router skill with a `PROJECT.md` template and model role guidance.
- `agent-guardrails` skill for scope control, shell limits, loop breaking, and unattended runs.
- `project-architecture` skill with a canonical folder layout and a refactor-first playbook.
- Payload skills for bootstrap, admin branding, localization, live preview, media, SEO and GEO, legal and trust pages, forms and CRM, bookings and payments, integrations, MCP, auth and RBAC, performance, testing, and Vercel deployment.
- Skill validator and weekly upstream version check in GitHub Actions.
- Contributor documentation, issue templates, and pull request template.

### Changed

- All guidance pinned to Payload 3.x stable (verified 3.94.0) and Next.js 16.
- SQLite configuration keeps Payload's default transaction behavior; `transactionOptions: {}` is no longer recommended.
- Cache revalidation uses the two-argument `revalidateTag` required by Next.js 16.
- Cache invalidation is designed as a metered cost, based on a production audit where a site used 72% of the Vercel Hobby ISR write allowance: no shared tags on content queries, no layout-wide revalidation for ordinary content, per-document targets functions, media uploads that revalidate nothing, no time-based revalidation on pages covered by targets, and an invalidation map in `PROJECT.md`.
- Uploads go directly from the browser to storage instead of through serverless functions.

### Removed

- Legacy `SKILL.md` and `reference/` folder, including links to files that did not exist.
