# Contributing

Thanks for helping. This repo is a set of instructions that agents execute literally, so precision matters more than volume.

## Ground rules

- **English only.** Every file in the repo is written in English. CI rejects Arabic script.
- **Verified only.** Every snippet must match the pinned versions in [versions.json](versions.json). If you used a newer version, update `versions.json` in the same pull request and say what you checked.
- **Payload 3.x stable.** Do not add Payload 4 APIs (`@payloadcms/transformer-sharp`, `variants`, `type: 'slug'`, `custom.css`, `ui4` tokens) until v4 is stable and the migration issue is closed.
- **Free tier first.** Prefer services and libraries with a usable free tier. State the limit when it affects the design.
- **No tool-specific syntax** in skill bodies. Write "run this command" and "edit this file", not tool names from one editor.

## Skill format

Each skill is a folder under `skills/`:

```text
skills/<skill-name>/
  SKILL.md          required: frontmatter + instructions
  references/       optional: details loaded only when needed (one level deep)
  assets/           optional: files the agent copies into a project
```

Frontmatter:

```yaml
---
name: skill-name            # lowercase letters, digits, hyphens; must equal the folder name; 64 chars max
description: What it does and when to use it, with trigger words. 1024 chars max.
license: MIT
metadata:
  version: "1.0.0"
---
```

## Writing rules

1. Start with when to use the skill and what it produces.
2. Write numbered, imperative steps with exact file paths and commands.
3. Use decision tables instead of prose when there is a choice.
4. Give one recommended path. Put alternatives in a table or a reference file.
5. End with a **Done when** checklist the agent can verify by running commands.
6. Add **Stop and ask** conditions for anything that needs a credential, a paid plan, or a client decision.
7. Keep `SKILL.md` under 500 lines (aim for 300). Move long code and edge cases into `references/`.
8. Refer to other skills by name in backticks, for example `payload-media`. Do not link across skill folders, because users may install skills individually.
9. Code follows the conventions in `skills/project-architecture/references/code-conventions.md`.

## Local checks

```bash
npm run validate
```

The validator checks frontmatter, name and folder match, description length, line limits, relative links, cross-skill name references, and English-only content. It needs Node.js 20 or later and has no dependencies.

## Pull requests

1. Open or reuse an issue that describes the problem.
2. Branch from `master` as `<type>/issue-<number>-<slug>` (types: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`).
3. Keep commits atomic and reference the issue, for example `fix: correct Kashier signature order (#12)`.
4. Fill in the pull request template, including how you verified the change.
5. CI must pass before merge.

## Reporting a wrong instruction

If an agent followed a skill and produced broken code, open a **Skill bug** issue with the skill name, the model, the step that failed, and the error output. These are the most valuable reports.
