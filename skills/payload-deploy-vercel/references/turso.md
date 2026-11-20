# Turso for this project

Payload's SQLite adapter uses `@libsql/client` (pinned in `versions.json`). Turso Cloud hosts two engines. Create the libSQL one.

| Command | What it does | Source |
| --- | --- | --- |
| `turso db create <name>` | Creates a libSQL database. This is the one Payload can open. | https://docs.turso.tech/quickstart.md |
| `turso db create <name> --tursodb` | Creates the newer Turso engine. Do not use it. The TypeScript quickstart connects that engine with `@tursodatabase/serverless`, which this project does not use. | https://docs.turso.tech/sdk/ts/quickstart.md |
| `turso db locations` | Prints the location codes you are allowed to pass. | https://docs.turso.tech/cli/db/locations.md |
| `turso group create <group> --location <code>` | Creates the group in that location. The flag is a code from `turso db locations`. The group docs call it a three-digit code. | https://docs.turso.tech/cli/group/create.md |
| `turso db create <name> --group <group>` | Puts the database in an existing group. | https://docs.turso.tech/cli/db/create.md |
| `turso db show <name>` | Prints the URL, group, and location. `DATABASE_URL` must be the `libsql://` URL. | https://docs.turso.tech/cli/db/show.md |
| `turso db tokens create <name>` | Prints a token. Default is full access and no expiry. | https://docs.turso.tech/cli/db/tokens/create.md |

`--url` on `turso db show` is documented as the HTTP API URL. If that flag prints `https://`, use the `libsql://` URL from the unflagged `turso db show` output. Do not rewrite the scheme yourself. If neither output contains `libsql://`, stop and read https://docs.turso.tech/sdk/ts/quickstart.md (the "Remote libSQL database" section) before continuing.

Do not install `@tursodatabase/database` or `@tursodatabase/serverless`. Do not add a package to `versions.json`.

## One group, two databases

Creating more than one group is limited to Scaler, Pro, and Enterprise. Verify at https://docs.turso.tech/cli/group/create.md

On the free plan, production and preview share a group, which means they share a primary location. That is what you want: the Vercel region and both databases stay in the same place.

```bash
turso db locations
turso group create <project> --location <code-from-that-list>
turso db create <project>-prod --group <project>
turso db create <project>-preview --group <project>
turso db tokens create <project>-prod
turso db tokens create <project>-preview
```

If a group already exists, use it when its location is acceptable. If it is on the wrong continent, stop and ask. Do not create a second group on a free plan, and do not destroy the existing group to recreate it.

Do not pass `--read-only` on the server token. Payload writes. Do not pass `--expiration` unless the client will rotate the token on a calendar. An expired token takes the site down. The default does not expire. Record that fact in `PROJECT.md` (the fact, not the token). Invalidating tokens is `turso db tokens invalidate <database-name>` (listed in the Turso CLI index). Run it only when the client asks to rotate, and update the Vercel variable in the same session.

The token is printed once. Put it in the Vercel environment and, for local production-like checks, in the gitignored `.env`. Then clear the shell scrollback if the terminal is shared.

## Region pairing

Hobby allows one function region, set in `vercel.json`:

```json
{ "regions": ["fra1"] }
```

`fra1`, `iad1`, and `sfo1` appear in https://vercel.com/docs/functions/configuring-functions/region (`iad1` is the default, `sfo1` is the documented example, `fra1` is a documented failover region). Pick the one in the same metro as the Turso location code you actually used. Do not assume a Turso code equals a Vercel code. The full Vercel list is https://vercel.com/docs/regions

Write both codes in `PROJECT.md`.

## Point-in-time restore

https://docs.turso.tech/features/point-in-time-recovery.md

| Plan named on that page | Window |
| --- | --- |
| Free | Any point in the last 24 hours |
| Developer | 10 days |
| Scaler | 30 days |
| Pro | 90 days |

The billing page (https://docs.turso.tech/help/usage-and-billing.md) talks about Starter and Scaler quotas instead, and says a query past the quota fails with `BLOCKED`. Plan names do not match across the two pages. Before you promise a restore window, re-read the point-in-time page and `turso plan show` on the client's account.

Restore creates a new database. It does not rewind the current one, and it does not bring back a database you deleted.

```bash
turso db create <project>-restore --from-db <project>-prod --timestamp 2026-01-15T12:00:00Z
turso db tokens create <project>-restore
```

Then set Production `DATABASE_URL` and `DATABASE_AUTH_TOKEN` to the new database and redeploy. Keep the old database until the client confirms the restore. Deleting it is a separate decision. Restores count against the database quota.

There is no automatic restore on the free plan. Do not describe Turso as having continuous backup beyond what that page states.
