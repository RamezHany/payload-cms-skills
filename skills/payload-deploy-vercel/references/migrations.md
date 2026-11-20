# Migrations

Source: https://github.com/payloadcms/payload/blob/3.x/docs/database/migrations.mdx and the SQLite adapter page on the same branch (`docs/database/sqlite.mdx`).

Payload stores migrations in `src/migrations`. Each file exports `up` and `down`. On SQLite, transactions are off by default and must stay off, so a failed `up` is not rolled back. Read the SQL before you commit it. An `up` that drops a column is not safe to deploy in the same release that removes the field from the config; use expand/contract below.

Push is enabled in development only. Production does not push. The two modes must not be used on the same database. Payload warns if you migrate a database that push has been altering.

## Commands

Run them through the package script so the template's `NODE_OPTIONS` applies.

| Command | When |
| --- | --- |
| `pnpm payload migrate:create` | After a schema change, before the deploy that needs it. Add a short name: `pnpm payload migrate:create posts-excerpt`. |
| `pnpm payload migrate` | Applies migrations that have not run. This is the production and preview path, via the `ci` script. |
| `pnpm payload migrate:status` | Read-only list of what has run. Safe against any database you are willing to connect to. |

Forbidden against Turso, production or preview: `migrate:fresh`, `migrate:reset`, `migrate:down`, `migrate:refresh`. The `agent-guardrails` skill allows them only on a local file created for that experiment. `migrate:fresh` drops every table.

If `migrate:create` reports no schema changes, do not force a blank file.

## Prove a migration on an empty file

The dev database was built by push. Do not apply the new migration to it.

`cross-env` is already a dependency of the website template.

```bash
pnpm exec cross-env DATABASE_URL=file:./.data/migrate-check.db NODE_OPTIONS=--no-deprecation payload migrate
pnpm exec cross-env DATABASE_URL=file:./.data/migrate-check.db NODE_OPTIONS=--no-deprecation payload migrate:status
```

Delete `.data/migrate-check.db` afterwards. Both commands must succeed before the first production deploy. The status output should list every committed migration as run.

The first production deploy of an empty Turso database runs this same sequence inside `pnpm run ci`. If `src/migrations` is empty, `payload migrate` succeeds and creates nothing, push is off, and every API call fails with a missing table. The initial migration is required even when you have not "changed" anything since push created the local file.

## Build script

```json
"ci": "pnpm payload migrate && pnpm build"
```

Vercel Build Command: `pnpm run ci`. Install command stays the platform default (`pnpm install`). Do not set an output directory.

Preview deployments use the same build command. That is safe only because Preview's `DATABASE_URL` is the preview database. Check the build log's host if you are unsure which database was migrated.

Do not add `prodMigrations` to `sqliteAdapter`. On Vercel that runs during cold start. The migrate-then-build script is the path Payload documents for CI.

## Expand then contract

Use two deploys when a change would drop or rename a column, or stop writing a field that old code still reads.

1. Expand. Add the new field as optional. Deploy. Backfill old documents in a script that passes `context: { disableRevalidate: true }` on every Local API call, then revalidates once if the public pages need it (the `payload-performance` skill).
2. Contract. After every running deployment reads the new field, remove the old field and deploy the migration that drops the column.

Vercel can roll back the code of step 1. It cannot put back a column that step 2 dropped. Do not combine the steps because "it is a small field".

Review the generated SQL for `DROP TABLE` and `DROP COLUMN`. Either is a contract step and needs the old code to be gone first.
