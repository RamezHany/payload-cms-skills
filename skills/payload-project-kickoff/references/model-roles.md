# Model roles

Any model can follow these skills. Splitting work by role keeps cost down and quality up. Pick by task size, not by brand loyalty.

## Recommended split

| Role | Task size | Good fits | Instructions to give |
| --- | --- | --- | --- |
| Designer | Figma screens, design system, admin look | Muse, Gemini | Work in Figma only. Annotate every component with its source library link and the CMS field it binds to. |
| Builder | A full phase (bootstrap, live preview, booking flow) | Gemini, Claude, Grok | One phase per session. Follow the phase skill end to end, then run its "Done when" checks. |
| Task runner | One file or one small change with exact paths | DeepSeek, Xiaomi MiMo, OpenCode Big Pickle | Give the exact file paths, the skill step number, and the expected result. No open-ended tasks. |
| Reviewer | Diff review before merge | Claude, Opus | Review the diff against the skill's "Done when" list and `agent-guardrails`. Report issues; do not rewrite. |

## Handoff format

Every handoff between models goes through `PROJECT.md`:

1. The finishing model writes a `## Session log` entry: done, not done, blockers, next step.
2. The next model starts with `payload-project-kickoff`, which reads that entry.

## Prompts that work across models

- State the phase and the skill: "Phase 4. Use the `payload-live-preview` skill for the posts collection."
- State the boundary: "Only edit files under `src/collections/Posts` and `src/app/(frontend)/[locale]/posts`."
- State the check: "Done when the save-persist test in `payload-testing` passes for posts."

## Unattended runs

For overnight or turbo runs, give one phase, require a feature branch, and require the guardrails' unattended checklist. Cheap models in unattended mode get only task-runner work with exact paths.
