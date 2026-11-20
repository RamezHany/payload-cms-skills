# Roadmap

## Current: v1

v1 is the 18 skills in `skills/`. `payload-project-kickoff` routes a session through them. The layout and the phase order are in [ARCHITECTURE.md](ARCHITECTURE.md).

| Group | Skills |
| --- | --- |
| Entry | `payload-project-kickoff` |
| Always loaded | `agent-guardrails` |
| Layout | `project-architecture` |
| Setup and admin | `payload-bootstrap`, `payload-admin-branding`, `payload-localization`, `payload-auth-rbac` |
| Content | `payload-live-preview`, `payload-media`, `payload-seo-geo`, `payload-legal-trust` |
| Business | `payload-forms-crm`, `payload-bookings-payments`, `payload-integrations`, `payload-mcp` |
| Quality | `payload-performance`, `payload-testing`, `payload-deploy-vercel` |

## Next: Figma and creative frontend skills

The next pull request adds Figma handoff skills and creative frontend skills. The set is limited to free offerings.

Before a skill or a generated project uses a component, confirm that component's license and that the free tier covers the use. Paid, Pro, and unlicensed code stays out. The shadcn CLI may fetch one named registry component. It is not the base design system. `payload-project-kickoff` already records that rule, and `PROJECT.md` lists the approved libraries and the exact components.

In scope:

- **GSAP**, including every plugin. Since the GSAP 3.13 release on 29 April 2025 the plugins are free for commercial use. Install them from the public `gsap` package. No Club license key and no private registry. Sources: [gsap.com/blog/3-13](https://gsap.com/blog/3-13/) and [gsap.com/pricing](https://gsap.com/pricing/).
- **Theatre.js.** `@theatre/studio` is AGPL-3.0 and is a development tool. The production bundle ships `@theatre/core` (Apache-2.0) and leaves the studio out. Source: [@theatre/studio](https://github.com/theatre-js/theatre/blob/main/packages/studio/README.md).
- **Rive.** The official runtimes are MIT, with no runtime fee. The free plan allows unlimited local CLI builds and 50 publishes or pushes a month. Free exports play a Rive splash screen. Sources: [runtimes](https://rive.app/docs/runtimes/getting-started) and [pricing](https://rive.app/pricing).
- **Uiverse.** Elements in [uiverse-io/galaxy](https://github.com/uiverse-io/galaxy) are MIT. Keep the copyright notice with a copied element.
- **three.js and React Three Fiber.** Documentation: [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/).
- **React Bits, Lenis, Motion, Cult UI, Magic UI, Animate UI, recent.design, and 21st.dev.** Free components only, after the license check above.
- **Aceternity UI and hover.dev.** Free components only. Pro and other paid components are out of scope.
- **Codrops demos on tympanus.net.** Read that demo's license before reusing it. Demos on the same site do not share one license.

## Later

- **Project Pack generator.** A static page that collects the brief and writes `PROJECT.md`, `AGENTS.md`, and the `npx skills add RamezHany/payload-cms-skills` command. No account and no server.
- **MCP server** for this library, so an agent can list skills and read the skill that matches the task.
- **Payload 4**, after it is stable. Skills stay on Payload 3.x until the migration issue is closed. The `payload-v4` entry in [versions.json](../versions.json) records that policy. When the `payload` `latest` dist-tag reaches 4.x, the weekly workflow opens the drift issue, and the report tells you to open a migration issue before editing skills. The rule is in [VERSIONS.md](VERSIONS.md).
