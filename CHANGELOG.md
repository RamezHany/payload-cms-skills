# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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
- Uploads go directly from the browser to storage instead of through serverless functions.

### Removed

- Legacy `SKILL.md` and `reference/` folder, including links to files that did not exist.
