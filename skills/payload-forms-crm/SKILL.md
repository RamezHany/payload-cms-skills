---
name: payload-forms-crm
description: Lead capture and a small CRM for Payload CMS 3. Custom leads collection (default) versus the form builder plugin, server-action submission with Zod, honeypot, Turnstile, and a serverless rate limit, sales access, CSV export without a jobs worker, and no cache revalidation on submit. Use when adding a contact form, lead inbox, CRM status, follow-up, or CSV export of submissions.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload forms and CRM

Produces a `leads` collection, one server-rendered submission path, and a CSV export. Fixed forms designed in code are the default. Editor-built forms are the exception.

## Step 1: Choose the path

| | Custom `leads` (default) | `@payloadcms/plugin-form-builder` |
| --- | --- | --- |
| Who changes the form | A developer, in a deploy | An editor, in the admin |
| Stored shape | Named fields, status, assignee | `submissionData` pairs, plus whatever you add |
| Public REST create | Closed. The server action writes through the Local API | Open on `form-submissions` unless you override it |
| Fits | Contact, quote, and newsletter forms that rarely change | A client who must publish new forms without a developer |
| Extra cost | A small code change per form | Generic data, a public write endpoint to lock down, and no CRM status until you add fields |

Record the choice in `PROJECT.md`. Use the custom path unless the brief says editors create forms themselves. The plugin path is [references/export-and-form-builder.md](references/export-and-form-builder.md).

## Step 2: Leads collection

Create `src/collections/Leads/index.ts` from [references/leads-collection.md](references/leads-collection.md) and register it in `src/payload.config.ts`.

Decisions already made, matching the access matrix in the `payload-auth-rbac` skill:

| Action | Who | Why |
| --- | --- | --- |
| Create | Server action only (`create` access returns false) | Validation, Turnstile, and the rate limit stay in one place. The Local API skips access unless you pass `overrideAccess: false` |
| Read and update | `admin` and `sales`, every lead | These sites have a shared inbox. `assignedTo` is a workflow field, not a privacy boundary |
| Update of status, notes, assignee, follow-up | `admin` and `sales` | Sales works the queue |
| Update of the submitted fields, and read of `ipHash` | `admin` only | The original message stays intact. The hash is not an export column |
| Delete | `admin` only | Submissions are a record |

If `PROJECT.md` says representatives must not see each other's leads, change read and update for `sales` to `{ or: [{ assignedTo: { equals: user.id } }, { assignedTo: { exists: false } }] }` so the unassigned queue stays visible. Do that only after the client confirms it.

`defaultSort` is a collection option (not under `admin`) and is `-createdAt`. Payload remembers a list sort once someone changes it in the admin, so a user who clicked another column will not see the default again until that preference is cleared.

Run `pnpm generate:types`.

## Step 3: Submission

Extend the lead form from the `project-architecture` skill. Full files: [references/submission-flow.md](references/submission-flow.md).

1. Shared Zod schema in `src/features/leads/schema.ts`. Email uses `z.email()`. The page URL uses `z.url()`. Phone numbers go through `libphonenumber-js` (`parsePhoneNumberFromString`, then `isValid()`, store `number` which is E.164). Do not write a regex for email, URL, or phone. Install `libphonenumber-js` at the version in `versions.json`.
2. `src/features/leads/actions.ts` is a server action. It re-validates with `safeParse`, rejects a filled honeypot, verifies Turnstile with `verifyTurnstile` from the `payload-integrations` skill, then counts recent leads with the same `ipHash` through the Local API.
3. Hash the IP with SHA-256 and `LEAD_IP_HASH_SALT`. Never store or log the raw IP. If the salt or the Turnstile secret is missing, refuse the submission.
4. Create the lead with the Local API and `overrideAccess: true` (collection create is closed). Then `after()` from `next/server` sends the notification email and appends the sheet row. A failure there is logged with the lead id only and does not change the response the visitor already received.
5. `src/features/leads/components/LeadForm.tsx` uses React Hook Form, `zodResolver`, and `useMutation`. Error codes are translated with next-intl. Inputs use `aria-invalid` and `aria-describedby`. Layout uses logical Tailwind utilities (`text-start`, `ps-3`) so RTL does not need a second stylesheet.

The consent label is legal copy. Take it from the `payload-legal-trust` skill. The checkbox and `consentAt` are required here.

## Step 4: CSV export

Add `@payloadcms/plugin-import-export` in `src/plugins/index.ts`. `disableJobsQueue` is a per-collection export option, not a top-level plugin option. It runs the export inside the request instead of leaving a job pending. Vercel Hobby has no long-running worker, and Payload's `jobs.autoRun` does not run between serverless invocations, so the synchronous option is required.

```ts
import { importExportPlugin } from '@payloadcms/plugin-import-export'

import { hasRole } from '@/access/hasRole'

importExportPlugin({
  collections: [
    {
      slug: 'leads',
      import: false,
      export: {
        format: 'csv',
        disableJobsQueue: true,
        disableSave: true,
        limit: 5000,
        hooks: {
          before: ({ data }) => data.map(escapeRow),
        },
      },
    },
  ],
  overrideExportCollection: ({ collection }) => ({
    ...collection,
    access: {
      create: hasRole('admin', 'sales'),
      read: hasRole('admin', 'sales'),
      update: hasRole('admin'),
      delete: hasRole('admin'),
    },
  }),
}),
```

`import: false` keeps bulk import from skipping consent and Turnstile. `disableSave: true` streams the download and does not store a copy of the personal data in an uploads collection. The export drawer chooses rows (all, current filters, or the selection) and columns. `ipHash` is removed from that picker with `custom['plugin-import-export'].disabled: true`.

`escapeRow` prefixes any string cell whose first character is `=`, `+`, `-`, `@`, tab, or carriage return with a single quote. Do the same wherever this project builds a CSV itself. The hook code is in the export reference. After a download, confirm a message that starts with `=` is stored with the quote prefix. If that hook does not run for a direct download, put the same prefix in each text field's `hooks.beforeExport`.

Hobby functions can run up to 300 seconds (fluid compute). A 5000-row synchronous export that times out needs a lower `limit`, not a jobs queue.

## Step 5: Do not revalidate

Leads are not public. Do not add an `afterChange` hook that calls `revalidatePath` or `revalidateTag`. Do not add a cache tag for leads. Paste this row into the invalidation map in `PROJECT.md`, following the `payload-performance` skill:

```markdown
| leads | any write | none | none | 0 |
```

Creating a lead must not print a `revalidate (...)` log line.

## Environment variables

```bash
LEAD_IP_HASH_SALT=
LEAD_NOTIFY_EMAIL=
LEAD_PHONE_COUNTRY=SA
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
GOOGLE_SHEETS_LEAD_ID=
```

Turnstile, email, and Sheets variables are defined in the `payload-integrations` skill. `LEAD_PHONE_COUNTRY` is an ISO 3166-1 alpha-2 code from `PROJECT.md`, used only when the visitor did not type an international number.

## Stop and ask

- The notification inbox, the Turnstile production keys, and the Google sheet id.
- Whether sales sees every lead or only assigned leads.
- Whether editors must build forms without a deploy (Step 1).
- The consent sentence and the default phone country.
- A form that uploads files. Files do not go through this action (1 MB server-action body). Use the `payload-media` skill.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Lead never appears | Create access blocked the Local API | Pass `overrideAccess: true` only after the checks in Step 3 |
| `revalidate (` in the log on submit | A hook treats leads like a public collection | Remove it (Step 5) |
| Export stays "pending" | Jobs queue is on and nothing runs it | `disableJobsQueue: true` on the leads export config |
| Sales can delete | `delete` is not `hasRole('admin')` | Step 2 |
| Arabic page shows English errors | Messages missing under `leads` in that locale file | Submission reference |

## Done when

- [ ] Submitting `/en` and the other locale each creates one lead with locale, page URL, consent timestamp, and status `new`
- [ ] A filled honeypot, a failed Turnstile check, and a sixth submit inside the window each return a translated error and do not create a lead
- [ ] A sales user sees the list and can change status, and cannot delete
- [ ] An editor has no leads nav item
- [ ] Export downloads a CSV, a cell that started with `=` is prefixed, and `ipHash` is absent
- [ ] The server log for that create has no `revalidate (` line
