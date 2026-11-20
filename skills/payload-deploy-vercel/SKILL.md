---
name: payload-deploy-vercel
description: Deploy a Payload CMS 3 + Next.js 16 site to Vercel Hobby with a Turso libSQL database, build-time migrations, a separate preview database, cron authentication, and security headers that still allow live preview. Use when deploying, choosing a region, setting environment variables, attaching a domain, adding a cron, rolling back, or when production saves return 403, uploads return 413, or published content does not refresh.
license: MIT
metadata:
  version: "1.0.0"
---

# Deploy Payload on Vercel

Ship the project to Vercel Hobby with Turso as the database. Production runs migrations. Development keeps using Drizzle push. Preview never opens the production database.

Read [references/hobby-limits.md](references/hobby-limits.md) before choosing Hobby. Limits move. Every number in that file is tied to an official URL that you re-open before launch.

## Step 1: Decide whether Hobby is the right plan

Hobby is a free tier with included usage. When included usage is exceeded, the Hobby plan page says you wait until 30 days have passed before that feature works again. A content site that has spent its ISR allowance stays up and serves stale pages.

Stop and ask the client before deploying a commercial site. Team collaboration, more than one function region, cron jobs more than once a day, and rollback past the previous deployment are Pro features (see the limits reference). The Hobby plan page and the Acceptable Use Policy fetched for this skill do not themselves contain the sentence "Hobby is non-commercial only". Re-read both URLs in the limits reference and the client's Vercel agreement. If they restrict commercial use, do not deploy the client site on Hobby.

Record the decision in `PROJECT.md`.

## Step 2: Create the databases

Follow [references/turso.md](references/turso.md).

1. One Turso group, in the location closest to the audience. A second group is a paid-plan feature.
2. Two libSQL databases in that group: `<project>-prod` and `<project>-preview`. Do not pass `--tursodb`. Payload uses `@libsql/client`, which talks to libSQL. The `--tursodb` flag creates the newer Turso engine.
3. A token per database, full access, from `turso db tokens create`. Paste each token into the Vercel dashboard. Do not commit it, print it in a log, or copy it into `PROJECT.md`.
4. Set `vercel.json` `regions` to the single Vercel region nearest that Turso location. Hobby allows one region. The default when `regions` is omitted is `iad1`.

## Step 3: Migrations

Follow [references/migrations.md](references/migrations.md).

1. While developing, leave push on. Do not run `payload migrate` against the local dev file after push has been writing to it.
2. Before the first deploy, and before every later deploy that changes the schema, run `pnpm payload migrate:create`, read the SQL, and commit `src/migrations`.
3. Add this script to `package.json`:

```json
"ci": "pnpm payload migrate && pnpm build"
```

4. In the Vercel project, set the Build Command to `pnpm run ci`. The default `pnpm build` does not migrate, and production has push disabled, so the database stays empty.
5. Prove the migration on an empty local file before the first production deploy (the command is in the migrations reference).
6. Never run `migrate:fresh`, `migrate:reset`, `migrate:down`, or `migrate:refresh` against Turso. The `agent-guardrails` skill allows those only on a local file you created for that purpose.

Breaking changes use expand then contract, in two deploys. A single migration that drops a column cannot be rolled back by a Vercel rollback, because rollback does not touch the database.

Do not set `prodMigrations` on the SQLite adapter. Payload's deployment docs say that runs migrations on every cold start and is for long-running servers, not Vercel.

## Step 4: Environment variables

Fill Production, Preview, and Development from [references/environment.md](references/environment.md).

The production `DATABASE_URL` and `DATABASE_AUTH_TOKEN` are enabled for Production only. The preview pair is enabled for Preview only. A token that is present in both environments lets a preview build migrate the client database.

`NEXT_PUBLIC_` is inlined into the browser bundle. Only values that are safe to show a visitor get that prefix. `PAYLOAD_SECRET`, `DATABASE_AUTH_TOKEN`, `PREVIEW_SECRET`, `CRON_SECRET`, storage secrets, email API keys, webhook secrets, and the Google private key never get it.

On Preview, leave `NEXT_PUBLIC_SERVER_URL` unset. Server code derives the origin from `VERCEL_URL` (no protocol; the docs are in the environment reference). The browser uses `window.location.origin`, which the `payload-live-preview` skill already requires.

## Step 5: Region file and cron

Copy [assets/vercel.json](assets/vercel.json) to the project root. Replace `fra1` with the region from Step 2. `fra1` is a real Vercel region code used in the region docs; it is not the right choice for every audience.

The copied route exports `maxDuration = 60`. Hobby's maximum function duration is 300 seconds (see the limits reference). Do not set `maxDuration` higher than the plan maximum.

The cron schedule `0 3 * * *` runs once a day. On Hobby, Vercel runs it sometime during that hour, not at 03:00 exactly, and a schedule that fires more than once a day fails the deployment. Verify the current Hobby row at https://vercel.com/docs/cron-jobs/usage-and-pricing before changing the expression. That page also says Cron Jobs are a legacy feature being moved to Schedules. If the project has already been migrated, follow the Schedules page linked from there and keep the same guarantees: authenticated, at most daily on Hobby, safe to run twice.

Copy [assets/expire-holds-route.ts](assets/expire-holds-route.ts) to `src/app/api/cron/expire-holds/route.ts` only when the project expires booking holds. Vercel sends `Authorization: Bearer <CRON_SECRET>` on the production deployment. The route returns 401 when the header is missing or wrong, and 200 when it matches. Wire the hold-expiry function the bookings feature exports. Omit the `crons` key entirely when there is nothing to run; do not deploy a cron that returns 200 and does nothing while `PROJECT.md` claims it cleans holds.

`CRON_SECRET` is captured when the deployment builds. Changing it in the dashboard does nothing until the next production deployment. Rollback restores the secret of the deployment you roll back to.

## Step 6: Security headers

Add `headers()` as in [references/security-headers.md](references/security-headers.md).

`Content-Security-Policy` includes `frame-ancestors 'self'` so the admin can frame live preview on the same origin. Do not set `X-Frame-Options: DENY`. Do not set `frame-ancestors 'none'`.

Add a third-party host only when that feature is enabled. The reference lists the hosts to add for Cloudinary, R2, Mux, YouTube, Turnstile, and Google tags. Payment and wallet hosts come from the gateway's own docs via `payload-bookings-payments`. Do not guess them.

## Step 7: Domains, CSRF, and webhooks

In `src/payload.config.ts`, set `serverURL`, `csrf`, and `cors` to the same origin list:

| Environment | Origin |
| --- | --- |
| Development | `http://localhost:3000` |
| Production | `https://<production-domain>` |
| Preview | `https://${VERCEL_URL}` for that deployment |

A missing production origin is the usual cause of a 403 on save after launch. The `payload-auth-rbac` skill shows the fields.

Register payment, email, and Mux webhooks on the production domain only (`https://<production-domain>/api/webhooks/<provider>`). A preview URL changes every push. Do not put a preview URL in a gateway dashboard.

Add the production admin origin to the bucket CORS policy from the `payload-media` skill (`PUT`, `Content-Type`, `If-None-Match`).

Confirm the `payload-localization` skill's `src/proxy.ts` matcher still excludes `api`, so `/api/cron/...` and `/api/webhooks/...` are not redirected to a locale.

## Step 8: Rollback

Vercel Instant Rollback points the production domain at a previous deployment. It does not restore the database. On Hobby you can roll back only to the immediately previous production deployment. Verify at https://vercel.com/docs/instant-rollback

Use it only when the previous deployment can read the current schema. That is true after an expand deploy (new optional column) and false after a contract deploy (column dropped).

After a rollback, Vercel turns off automatic assignment of the production domain. The next git push does not go live until you promote a deployment (`vercel promote <deployment-url>` or the dashboard Manage button).

To restore data, create a new database from a point in time (Turso reference). Point `DATABASE_URL` and a new token at that database and redeploy. Deleting the old database is a separate, explicit step. Free-plan point-in-time restore is a limited window; confirm it on the Turso page before promising it to the client.

## Step 9: Launch checklist

Do these in order. Record each result in `PROJECT.md`.

1. The Vercel build log shows `payload migrate` and then `next build`. The migrate step connected to `<project>-prod`, not the preview database.
2. The Preview environment's `DATABASE_URL` host is the preview database. A preview deployment's build log shows that host.
3. `curl.exe -s -o NUL -w "%{http_code}" https://<domain>/api/cron/expire-holds` prints `401`. The same request with `Authorization: Bearer` and the production `CRON_SECRET` prints `200`. Do not echo the secret. Skip this item when the project has no cron, and write that down.
4. `curl.exe -sI https://<domain>` shows `content-security-policy` containing `frame-ancestors 'self'`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy`, and `strict-transport-security`. It does not show `x-frame-options: DENY`.
5. On the production domain, edit a title in the admin and watch the live preview iframe update. Then publish and load the public URL; the new title is there.
6. Sitemap and robots URLs that the project actually serves return 200. The website template's `postbuild` runs `next-sitemap`. If the project also has route handlers under `src/app/(frontend)/(sitemaps)/`, check those paths too.
7. Search Console: stop and ask for access to the property. Do not invent a verification token.
8. The consent banner blocks analytics before the visitor accepts. That behavior is owned by `payload-legal-trust`.
9. Open the Vercel Usage page. Record the included ISR allowance exactly as labeled (write count or 8 KB write units) and the current usage. This is the baseline. Compare it with the invalidation map from the `payload-performance` skill.
10. Record Lighthouse mobile scores for the home page, a post, and the booking page, as that skill describes.

Check the Usage page weekly for the first month. If ISR usage climbs faster than (publishes per day times writes per save), a hook is revalidating more than its map row. Fix it before the allowance runs out. At 100% the site keeps serving the last generated HTML and new publishes stop appearing.

## Stop and ask

- The site is a commercial client project and the plan is still Hobby.
- Nobody can create the Turso group, the tokens, or the DNS records.
- The existing Turso group is in the wrong region. A second group needs a paid Turso plan.
- The client needs cron more often than daily, or timing tighter than one hour.
- A schema change cannot be split into expand and contract.
- Search Console or a payment-gateway dashboard needs a login you do not have.

## Done when

- [ ] A new production deployment log shows `payload migrate` before `next build`, against `<project>-prod`
- [ ] Preview's database host is `<project>-preview`, and no preview env var points at production
- [ ] `vercel.json` `regions` has one region, the one nearest the Turso group
- [ ] Cron returns 401 without `CRON_SECRET` and 200 with it, or `PROJECT.md` says there is no cron
- [ ] `curl.exe -sI` on the production origin shows the headers in Step 9.4 and does not show `X-Frame-Options: DENY`
- [ ] Live preview updates a title on the production domain
- [ ] `PROJECT.md` has the Usage baseline, the invalidation map, and the Lighthouse scores
