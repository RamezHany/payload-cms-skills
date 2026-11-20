---
name: agent-guardrails
description: Hard operating rules for coding agents on Payload CMS + Next.js projects, especially unattended, overnight, or turbo runs. Use in every session. Prevents scope creep, rebuilding from scratch, throwaway scripts that roam the machine, retry loops that burn tokens, leaked secrets, destructive database commands, and false "done" claims.
license: MIT
metadata:
  version: "1.0.0"
---

# Agent guardrails

These rules override any instinct to improvise. When a rule and a task conflict, follow the rule and record the conflict in `PROJECT.md` under `## Questions`.

## 1. Scope

1. Do only the current phase in `PROJECT.md`. Do not start the next phase, add unrequested features, or "improve" unrelated code.
2. Never start from scratch when code exists. Never re-scaffold, re-initialize, or replace a working project. Extend it.
3. Never rewrite a working file to change its style. Change only the lines the task needs.
4. If the task is unclear, write the question under `## Questions` and work on the parts that are clear.

## 2. Shell use

Allowed commands, run from the project root only:

| Purpose | Commands |
| --- | --- |
| Packages | `pnpm add`, `pnpm remove`, `pnpm install`, `pnpm view <pkg> version` |
| Payload | `pnpm payload <command>`, `pnpm generate:types`, `pnpm generate:importmap` |
| Next.js | `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint` |
| Checks | `pnpm tsc --noEmit`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec vitest run` |
| Git | `git status`, `git diff`, `git add`, `git commit`, `git switch -c`, `git log` |
| Scaffolding | `npx create-payload-app`, `npx degit` (only as written in a skill) |

Forbidden:

- Writing scripts (Python, Node, PowerShell, Bash) to search code, patch files, rename in bulk, inspect the system, or "explore". Use the editor's search, read, and edit tools instead.
- Any command that reads or writes outside the project folder, including the home directory, other projects, system folders, and global config.
- Global installs (`npm i -g`, `pip install`), `sudo`, piping downloads into a shell (`curl ... | sh`), changing system settings.
- Installing a language runtime or tool the project does not already use.
- Deleting files outside `node_modules`, `.next`, and test output folders without the task requiring it.

A script is allowed only when a skill ships it in `assets/` or `scripts/` and tells you to run it.

## 3. Loop breaker

1. Never run the same failing command more than twice without changing something relevant.
2. If the same error appears after two different fixes, stop fixing. Re-read the error, read the relevant skill's diagnosis table, and form a new hypothesis.
3. After three failed attempts on one problem, write an entry under `## Blockers` in `PROJECT.md` with the error output, what you tried, and your best hypothesis. Then move to the next independent task, or stop if none exists.
4. Run the cheap check first: `pnpm tsc --noEmit` before `pnpm build`. Never loop on `pnpm build`.
5. Start at most one dev server. Reuse it. Stop it when the session ends.
6. Do not poll or sleep in a loop waiting for something that is not running.

## 4. Dependencies

1. Install only packages named in a skill or in `PROJECT.md`.
2. Check the latest stable version with `pnpm view <package> version` and install that version.
3. Do not add a package that duplicates one already installed (a second date library, a second form library, a second icon set).
4. Never install a package with no release in the last 12 months unless a skill names it.

## 5. Secrets and data

1. Never print, echo, log, or commit secret values. Refer to variables by name.
2. Keep secrets in `.env.local` (development) and the hosting dashboard (production). Keep `.env.example` updated with names and placeholder values only.
3. Never run `payload migrate:fresh`, `migrate:reset`, `migrate:down`, or drop tables against any database except a local development file.
4. Never delete media, users, or submissions to "clean up" test data in a shared database.
5. Never paste real customer data into code, tests, or seed files.

## 6. Git

1. Work on a feature branch. Never commit or push to `main` or `master`.
2. Commit after each completed step with a message that names the step.
3. Never force push, rewrite published history, or commit `.env*` files other than `.env.example`.

## 7. Verification and honesty

1. A task is done only when the skill's "Done when" checks have been run and passed.
2. Report failing checks plainly. Never claim a test passed if you did not run it.
3. Do not disable tests, lint rules, or type checks to make a check pass. Do not add `// @ts-ignore` or `as any` to silence errors.

## 8. Stop and ask

Stop the affected task and write a question under `## Questions` when any of these is needed:

- a credential, API key, or account login
- a paid plan or a service outside the fixed stack
- legal text, prices, or business rules the brief does not state
- a change that deletes data or breaks an existing URL
- two requirements that contradict each other

In an interactive session, ask the user directly as well.

## 9. Unattended runs

Before starting an overnight or turbo run:

- [ ] One phase is selected in `PROJECT.md`
- [ ] A feature branch is checked out
- [ ] `.env.local` exists with the variables the phase needs; if not, skip tasks that need them

During the run, follow sections 1 to 8 strictly. Never wait for input: record questions and continue with independent tasks.

At the end of the run, add a `## Session log` entry to `PROJECT.md`:

```markdown
### 2026-01-15 - <model name>
- Done: <steps completed, with commit hashes>
- Not done: <steps left>
- Checks: <commands run and their results>
- Blockers: <links to Blockers entries>
- Next step: <the exact next action>
```

## Done when

- [ ] No command ran outside the project folder
- [ ] No throwaway scripts were created
- [ ] Every completed step is committed on a feature branch
- [ ] `PROJECT.md` has an up-to-date session log entry
