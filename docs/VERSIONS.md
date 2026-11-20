# Versions

[versions.json](../versions.json) is the only record of which package versions the skills were checked against. A snippet that needs a newer API is updated in the same pull request as this file.

## Fields

| Field | Role |
| --- | --- |
| `verifiedAt` | Date the pinned versions were last checked, `YYYY-MM-DD` |
| `packages` | Map of npm package name to the pinned version |
| `watch` | Named policy notes for a bump that needs a migration, not a routine edit |

`watch` is documentation for people and agents. [scripts/check-upstream.mjs](../scripts/check-upstream.mjs) does not read it. The current entry is `payload-v4`: when the `payload` package's `latest` dist-tag reaches 4.x, open a migration issue before changing any skill. The checker notices that event because `payload` is listed in `packages` and a new major sets drift.

## `npm run check:upstream`

`npm run check:upstream` runs `node scripts/check-upstream.mjs`. The script uses Node.js built-ins only.

For each entry in `packages` it requests `https://registry.npmjs.org/<name>/latest` and reads `version`. It compares the numeric part before any `-` prerelease suffix:

| Result | Meaning |
| --- | --- |
| `major` | Different major version |
| `minor` | Same major, different minor |
| `patch` | Same major and minor, different patch |
| `same` | Equal to the pin |
| `error` | The registry request failed |

It writes `upstream-report.md` at the repository root and prints the same markdown. The report header includes `verifiedAt`. The table lists every package that is not `same`, including patches and failed lookups. When `payload` itself is `major`, the report adds: open a migration issue before editing skills. When any package is `major` or `minor`, the report says to re-verify the affected skills and update `versions.json`.

Drift is `major` or `minor` only. Patches stay in the report and do not count as drift. A failed lookup is listed and does not count as drift on its own. If `GITHUB_OUTPUT` is set, the script appends `drift=true` or `drift=false`.

## Weekly workflow

[Upstream drift](../.github/workflows/upstream-drift.yml) runs at 06:00 UTC every Monday (`0 6 * * 1`) and on `workflow_dispatch`. The job checks out the repository, sets up Node.js 22, and runs `node scripts/check-upstream.mjs`.

When `drift` is `true`, the job looks for an open issue titled `Upstream drift: re-verify pinned versions`. If that issue exists, it comments with `upstream-report.md`. If it does not, it opens an issue with that title and the report as the body. Patch-only reports and lookup failures do not open an issue. The workflow does not edit `versions.json`.

## Re-verify and bump

1. Read the changelog for each drifted package and list breaking changes that affect a skill.
2. Update the snippets and reference files those changes touch.
3. In the same pull request, set the new versions and `verifiedAt` in `versions.json`.
4. Run `npm run validate` and fix every error.

[CONTRIBUTING.md](../CONTRIBUTING.md) requires the `versions.json` update in the pull request that introduces the newer API. Say what you ran and which docs you read.

A patch that does not change a snippet can still move the pin when you have confirmed the snippet still matches. The weekly issue will not remind you about patches.

## Payload 4

Skills use Payload 3.x APIs until Payload 4 is stable and the migration issue is closed. The 3.x line is what `verifiedAt` and the `payload` pin describe.

When the `latest` dist-tag of `payload` moves to 4.x, the checker marks `payload` as `major`, the report tells you to open a migration issue, and the Monday workflow opens or updates the drift issue. That issue is the gate. Leave every skill on the 3.x APIs until the migration is done.

APIs that wait for that migration include `@payloadcms/transformer-sharp`, `variants`, `type: 'slug'`, `custom.css`, and `ui4` tokens. The official `payload` skill installed into a project comes from the `3.x` branch for the same reason. See [ARCHITECTURE.md](ARCHITECTURE.md).
