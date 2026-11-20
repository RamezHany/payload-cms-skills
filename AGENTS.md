# Agent instructions for this repository

This repository is a library of Agent Skills. You are editing instructions that other agents will execute, not an application.

## Rules

1. Write in English only. Never add Arabic script to any file.
2. Read [CONTRIBUTING.md](CONTRIBUTING.md) before editing a skill. Follow its format and writing rules.
3. Keep every snippet valid for the versions in [versions.json](versions.json). Payload 3.x APIs only.
4. Refer to other skills by name in backticks, never by a relative link across skill folders.
5. Keep `SKILL.md` files under 500 lines. Move details into `references/`.
6. Do not add dependencies to `package.json`. Scripts use Node.js built-ins only.
7. Run `npm run validate` after every change and fix all errors before committing.

## Layout

- `skills/<name>/SKILL.md`: the skill entry point
- `skills/<name>/references/`: detail files, one level deep
- `skills/<name>/assets/`: files copied into projects
- `scripts/validate-skills.mjs`: structural and content checks
- `scripts/check-upstream.mjs`: compares `versions.json` with the npm registry
- `docs/`: architecture, install, roadmap, versions
