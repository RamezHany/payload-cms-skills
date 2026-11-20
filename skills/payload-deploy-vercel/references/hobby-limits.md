# Vercel Hobby limits

Re-open every URL below before launch and before you tell a client a number. The figures here are what those pages said when this skill was written. If a page disagrees with this file, the page wins, and you update `PROJECT.md` with the page's figure.

## Plan and fair use

| Topic | What to do | URL |
| --- | --- | --- |
| Included usage and the 30-day pause | Read the Hobby plan page. It says that when included usage is exceeded, you wait until 30 days have passed before that feature can be used again. | https://vercel.com/docs/plans/hobby |
| Commercial use | That page, and the Acceptable Use Policy, did not contain a sentence that Hobby is limited to non-commercial use. Still stop and ask before a client commercial site. Re-read both, plus the agreement on the client's team. | https://vercel.com/docs/plans/hobby and https://vercel.com/legal/acceptable-use-policy |
| Hobby vs Pro features | One function region, rollback only to the previous deployment, no team seats. Pro is the upgrade path on the Hobby page. | https://vercel.com/docs/plans/hobby and https://vercel.com/docs/instant-rollback |

## Functions, bodies, and cron

| Limit | Hobby figure on the docs page | URL |
| --- | --- | --- |
| Function duration | 300 seconds default and maximum (Fluid compute, Node.js) | https://vercel.com/docs/functions/limitations |
| Request body and response body | 4.5 MB. Over the limit the function returns 413 `FUNCTION_PAYLOAD_TOO_LARGE`. Streamed responses are not subject to the response-body limit. | https://vercel.com/docs/functions/limitations |
| Function regions | One. Default `iad1` when `regions` is omitted. | https://vercel.com/docs/functions/configuring-functions/region |
| Cron jobs per project | 100 | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron minimum interval | Once per day. A faster expression fails deployment. | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron timing | Per-hour. A job set for 03:00 can run any time in that hour (±59 minutes). | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron authentication | If `CRON_SECRET` is set, Vercel sends it as `Authorization: Bearer <value>` to the production deployment. | https://vercel.com/docs/cron-jobs/manage-cron-jobs |

The cron pricing page says Cron Jobs are a legacy feature that will be migrated to Schedules, and it links a Schedules limits page. Read that page too if the dashboard no longer shows Cron Jobs. Keep the route's bearer check either way.

`export const maxDuration` on a route handler cannot exceed the plan maximum. 60 seconds is inside the Hobby maximum of 300. Do not set a higher value to "be safe"; a value over the maximum fails the deployment.

## Included usage on the Hobby page

These are the included amounts the Hobby plan page listed. They are monthly unless the page says otherwise.

| Resource | Included |
| --- | --- |
| Active CPU | 4 CPU-hours |
| Provisioned memory | 360 GB-hours |
| Function invocations | 1,000,000 |
| Fast Data Transfer | 100 GB |
| Fast Origin Transfer | 10 GB |
| CDN requests | 1,000,000 |
| Image transformations | 5,000 |
| Image cache reads | 300,000 |
| Image cache writes | 100,000 |
| Deployments per day | 100 |

Image transformations are a reason to keep the custom image loader from the `payload-media` skill. A loader that resizes at Cloudinary or R2 does not spend this allowance.

## ISR

Two descriptions exist, and you record the one the project's Usage page shows.

The ISR pricing page measures writes and reads in 8 KB units, prices them by the function region, and says a revalidation that does not change the content incurs no write units. It does not publish a fixed "200,000 writes" cap. Verify at https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing

A production audit on 2026-11-20 found a Hobby Usage page that labeled an allowance of 200,000 ISR Writes. That site had used about 145,000 (about 4,800 a day) because every query shared a `cms-content` tag and media saves called `revalidatePath('/', 'layout')`. At 100% of that allowance, regeneration stopped and published edits no longer appeared. The pages already generated kept being served.

Before launch, and weekly for the first month:

1. Open the project's Usage page and write down the ISR label, the included amount, and the current usage. That is the baseline in `PROJECT.md`.
2. Compare the slope with the invalidation map from the `payload-performance` skill: publishes per day times writes per save, plus the first visit after each deploy.
3. A much steeper slope means a hook is wider than its map row. Fix the hook. Do not wait for the allowance to hit 100%.

The Hobby plan page's general rule for exceeded usage is a pause until 30 days have passed. Treat a spent ISR allowance as "edits stop appearing", even if the rest of the site still responds.
