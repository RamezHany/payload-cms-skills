---
name: payload-testing
description: Tests for a Payload CMS 3 + Next.js 16 site using the official website template's Vitest (tests/int) and Playwright (tests/e2e) setup. Use when adding tests, wiring GitHub Actions, diagnosing a save that hangs, returns 403 or 413, or never appears on the site, or proving that one save revalidates only the routes in the PROJECT.md invalidation map. Covers drafts, WebP uploads, live preview, locale sync, the role access matrix, payment signature vectors, webhook idempotency, and a local SQLite file per run.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload testing

Add tests to the Vitest and Playwright setup that ships in the official website template. Do not create a second runner, config, or `tests/` tree.

The template (3.x branch) pins this layout:

| Tool | Config | Files | Script |
| --- | --- | --- | --- |
| Vitest | `vitest.config.mts`, `vitest.setup.ts` | `tests/int/**/*.int.spec.ts` | `pnpm test:int` |
| Playwright | `playwright.config.ts` | `tests/e2e/` | `pnpm test:e2e` |
| Both | | | `pnpm test` |

Read the project's copies of those files before editing. Versions move; the project's `package.json` wins over any version named in this skill. At the time of writing, the 3.x website template pinned `vitest` 4.0.18 and `@playwright/test` 1.63.0 as devDependencies, and its `engines.node` range started at `^22.23.5`.

## Step 1: Point every test at a local SQLite file

Tests must never open a Turso or other remote database. A remote URL in `.env` is how a test run deletes or migrates a client database.

Follow [references/template-setup.md](references/template-setup.md). It keeps the template files and only:

1. Forces `DATABASE_URL` to a `file:` URL after `dotenv` loads, and deletes `DATABASE_AUTH_TOKEN`.
2. Uses one file for Vitest (`.data/vitest.db`) and a different file for Playwright (`.data/e2e.db`).
3. Runs Vitest in a single worker so SQLite does not throw `SQLITE_BUSY`.
4. Throws if the URL does not start with `file:`.

Do not add `transactionOptions` to the SQLite adapter. Payload leaves SQLite transactions off because enabling them locks the database.

## Step 2: Add the catalog

Keep the template specs (`tests/e2e/admin.e2e.spec.ts`, `tests/e2e/frontend.e2e.spec.ts`, `tests/int/api.int.spec.ts`, `tests/helpers/login.ts`, `tests/helpers/seedUser.ts`). Update `frontend.e2e.spec.ts` so it expects the project's real home title. Extend `seedUser.ts` with `name` once the users collection requires it (`payload-auth-rbac` skill).

Add the specs in [references/catalog.md](references/catalog.md):

| Spec | Proves |
| --- | --- |
| `tests/e2e/admin-save.e2e.spec.ts` | Create, save draft, reload, value persists, publish, frontend shows it |
| `tests/e2e/media-upload.e2e.spec.ts` | Admin upload stores WebP and the media URL is the storage host |
| `tests/e2e/live-preview.e2e.spec.ts` | Editing the title updates the preview iframe |
| `tests/e2e/locale-sync.e2e.spec.ts` | Content locale switches admin direction and the preview locale |
| `tests/int/access.int.spec.ts` | Local API with `overrideAccess: false` matches the role matrix |
| `tests/int/payments.int.spec.ts` | Official signature vectors, plus one tampered signature |
| `tests/int/webhooks.int.spec.ts` | The same event delivered twice confirms the booking once |

Payment and upload specs skip only in the cases the catalog names. A skip must print why. Do not delete a spec to make CI green.

## Step 3: Invalidation trace (required before delivery)

Add `tests/int/invalidation.int.spec.ts` from [references/invalidation-trace.md](references/invalidation-trace.md).

The spec mocks `next/cache`, performs one save per row of the `PROJECT.md` invalidation map, and fails unless the recorded `revalidatePath` and `revalidateTag` calls equal that row. It also fails when:

- a draft-only save or a new media upload revalidates anything
- any call uses the `'layout'` type except a row whose paths cell is `layout`
- any tag is `cms-content`, `all`, or `site`, or the same tag is emitted by two ordinary collections
- a public collection in the map has no case

Rewrite map cells into the expandable form in that reference. The meaning stays the one defined by the `payload-performance` skill. Do not weaken the test to match a broad hook.

## Step 4: Diagnose save failures

When a save spins, returns an error, or does not show on the site, use [references/save-failure-diagnosis.md](references/save-failure-diagnosis.md) before changing hooks or access rules. Confirm the row's check, then apply that row's fix.

## Step 5: GitHub Actions

Copy [assets/ci.yml](assets/ci.yml) to `.github/workflows/ci.yml`.

The workflow installs with pnpm, generates a throwaway `PAYLOAD_SECRET` (masked, never printed), points `DATABASE_URL` at a local SQLite file, then runs generate, lint, `tsc --noEmit`, Vitest, and Playwright. It uploads the Playwright report only when the job fails.

Before the first push, confirm the action major versions against the READMEs linked in the workflow comment. If an example there uses a newer major, use that major. Confirm `node-version` satisfies the project's `engines.node`.

Do not put storage keys, Turso tokens, payment secrets, or the production `PAYLOAD_SECRET` in the workflow. The upload spec skips without storage credentials. Run that spec locally before delivery.

## Stop and ask

- The only available database URL is a remote Turso database. Do not point tests at it.
- Storage credentials for the upload spec are missing and delivery requires that spec to have run.
- `payload-bookings-payments` has no official signature vectors yet. Do not invent signatures; skip the payment spec with that reason and record it in `PROJECT.md`.
- The template configs were replaced or the scripts were renamed, so the paths in Step 1 do not exist.

## Done when

- [ ] `tests/int/invalidation.int.spec.ts` lists every public collection and global in the `PROJECT.md` map, and `pnpm test:int` passes
- [ ] A draft save and a new media create assert zero `revalidatePath` and `revalidateTag` calls
- [ ] `pnpm test:e2e` passes locally with no other dev server on port 3000
- [ ] The media upload spec has been run against the configured storage provider (not merely skipped)
- [ ] `.github/workflows/ci.yml` is the copied workflow, and the GitHub Actions run is green
- [ ] No test file contains a `libsql://` URL or a `DATABASE_AUTH_TOKEN` value
