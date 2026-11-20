# Install

These skills follow the [Agent Skills](https://agentskills.io) format. Any agent that reads `SKILL.md` can use them. Paths below were checked against each tool's documentation on 20 November 2026.

The `skills` CLI (`skills` on npm, [vercel-labs/skills](https://github.com/vercel-labs/skills)) requires Node.js 22.20 or later. The validator in this repository requires Node.js 20 or later and has no npm dependencies.

## Install with the skills CLI

From the project you want the skills in:

```bash
npx skills add RamezHany/payload-cms-skills
```

The CLI asks which skills and agents to install. One skill:

```bash
npx skills add RamezHany/payload-cms-skills --skill payload-live-preview
```

`--skill` (`-s`) may be repeated. Other flags from the CLI reference:

| Flag | Effect |
| --- | --- |
| `-g`, `--global` | Install into your user directory instead of the project |
| `-a`, `--agent` | Target one agent. Examples: `cursor`, `claude-code`, `codex`, `opencode`, `gemini-cli`, `github-copilot` |
| `-y`, `--yes` | Skip confirmation prompts |
| `--all` | Install every skill for every agent the CLI supports |
| `--copy` | Copy files. The default method is a symlink to one canonical copy |

A project install writes `skills-lock.json`. Commit that file if you want `npx skills update` and `npx skills check` to track the installed set.

## Where each tool loads skills

Project paths are relative to the repository. User paths are relative to the home directory. A project install is the one to commit when the whole team should share the skills.

| Tool | Project | User |
| --- | --- | --- |
| Cursor | `.agents/skills/`, `.cursor/skills/` | `~/.agents/skills/`, `~/.cursor/skills/` |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| OpenCode | `.agents/skills/`, `.opencode/skills/` | `~/.agents/skills/`, `~/.config/opencode/skills/` |
| Gemini CLI | `.agents/skills/`, `.gemini/skills/` | `~/.agents/skills/`, `~/.gemini/skills/` |
| GitHub Copilot CLI | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | `~/.agents/skills/`, `~/.copilot/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |

Each skill is a directory containing `SKILL.md`. The `skills` CLI installs Cursor, Codex, OpenCode, Gemini CLI, and GitHub Copilot into `.agents/skills/` at project scope, and Claude Code into `.claude/skills/`.

Notes from the tool docs:

- **Cursor** also loads `.claude/skills/`, `.codex/skills/`, and the user-level equivalents. Cloud Agents sync `~/.cursor/skills/` only. They do not copy `~/.agents/skills/`. Project skills travel with the repository. Source: [cursor.com/docs/skills](https://cursor.com/docs/skills).
- **Codex** scans `.agents/skills` from the current directory up to the repository root. An admin install lives in `/etc/codex/skills`. Source: [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills).
- **OpenCode** treats `.agents/skills` and `.claude/skills` as compatibility locations. Its own directories are `.opencode/skills` and `~/.config/opencode/skills`, and those win when the same skill id exists in both places. Source: [opencode.ai/docs/skills](https://opencode.ai/docs/skills/).
- **Gemini CLI** uses `.agents/skills/` as an alias of `.gemini/skills/`. In the same tier, `.agents/skills/` wins. A workspace skill wins over a user skill. Source: [Gemini CLI skills.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md).
- **GitHub Copilot CLI** reads the directories in the table. In VS Code, the Copilot harness documents `.github/skills/` and `~/.copilot/skills/` as the locations it offers when you create a skill. That page says the table is not every directory the harness recognizes, and it does not name `.agents/skills/` for the Copilot harness. If a VS Code Copilot session ignores a project skill that exists only under `.agents/skills/`, install or copy it to `.github/skills/` as well. Sources: [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills), [VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills).
- **Claude Code** loads `.claude/skills/` and `~/.claude/skills/`. It also loads plugin skills and skills from managed settings. Its skills page does not list `.agents/skills/`. Source: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills).

## Manual install

Copy the skill folder, including `references/` and `assets/` when they exist:

```text
skills/payload-live-preview/   ->   .agents/skills/payload-live-preview/
```

Use the project or user directory from the table. For Claude Code the destination is `.claude/skills/payload-live-preview/`. To update a copied skill, replace that folder with the copy from this repository.

`npx skills check` reports updates. `npx skills update` reinstalls from the recorded source. Add `-g` to update the user install.

## First prompt

Open the project and tell the agent:

> Use the `payload-project-kickoff` skill. The brief is in PROJECT.md.

The kickoff skill loads the guardrails, detects the scenario, writes the plan into `PROJECT.md`, and routes each phase. How that routing works is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Official Payload skill

Install this library and Payload's own `payload` skill in the same project. This repository does not contain Payload's skill.

A new site gets it from `create-payload-app --agent`. On the 3.x line, the download defaults to the `3.x` branch. `payload-bootstrap` runs the command and records the exact flags. `cursor` and `codex` land in `.agents/skills/payload`. `claude` lands in `.claude/skills/payload`.

An existing project uses the command from `payload-project-kickoff`:

```bash
npx degit payloadcms/payload/tools/claude-plugin/skills/payload#3.x .agents/skills/payload
```

Keep the `#3.x` ref. The default branch documents Payload 4. Claude Code will not see a skill that exists only under `.agents/skills/`; for that tool, use `.claude/skills/payload` as the degit destination, or copy the folder there after the command above.
