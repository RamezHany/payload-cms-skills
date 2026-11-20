# Roadmap

## Current

`payload-project-kickoff` routes a session through the skills in `skills/`. The phase order is in [ARCHITECTURE.md](ARCHITECTURE.md) and in the repository README.

| Group | Skills |
| --- | --- |
| Entry | `payload-project-kickoff` |
| Always loaded | `agent-guardrails` |
| Layout | `project-architecture` |
| Design | `figma-handoff`, `creative-frontend` |
| Setup and admin | `payload-bootstrap`, `payload-admin-branding`, `payload-localization`, `payload-auth-rbac` |
| Content | `payload-live-preview`, `payload-media`, `payload-seo-geo`, `payload-legal-trust` |
| Business | `payload-forms-crm`, `payload-bookings-payments`, `payload-integrations`, `payload-mcp` |
| Quality | `payload-performance`, `payload-testing`, `payload-deploy-vercel` |

## Shipped with v1.1

- **Figma handoff** (`figma-handoff`) and **creative frontend** (`creative-frontend`). Free offerings only. The license record and the stop rules are in the creative skill.
- **Project Pack.** The static page in [project-pack/index.html](../project-pack/index.html) collects the brief and downloads `PROJECT.md`, `AGENTS.md`, and the install command. No account and no server.
- **Library MCP.** `node scripts/library-mcp.mjs` lists skills and reads the one that matches the task. This is the skills repository, not the Payload MCP plugin inside a website.

## Later

- **Payload 4**, after it is stable. Skills stay on Payload 3.x until the migration issue is closed. The `payload-v4` entry in [versions.json](../versions.json) records that policy. When the `payload` `latest` dist-tag reaches 4.x, the weekly workflow opens the drift issue, and the report tells you to open a migration issue before editing skills. The rule is in [VERSIONS.md](VERSIONS.md).
