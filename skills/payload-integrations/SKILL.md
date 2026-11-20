---
name: payload-integrations
description: Email, Google Sheets, Drive, and Search Console, plus Cloudflare Turnstile, for Payload CMS 3 sites on Vercel. Resend or Mailgun, a shared Google service account, formula-safe sheet appends, Drive uploads onto a Shared Drive, a small Search Console widget, and Turnstile siteverify. Use when sending email, appending leads to a spreadsheet, uploading to Drive, reading Search Console, or adding a captcha.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload integrations

Wires the services a marketing site actually calls. Calendar stays in the `payload-bookings-payments` skill. Lead storage stays in the `payload-forms-crm` skill. This skill supplies the adapters those features call.

## Step 1: Choose email

Use Resend unless the client requires message data to stay in the EU.

| | Resend via `@payloadcms/email-resend` (default) | Mailgun via `@payloadcms/email-nodemailer` SMTP |
| --- | --- | --- |
| Why this stack | Payload's email docs prefer it on serverless. The adapter calls the HTTP API. No SMTP sockets | Use it when the sending domain must live in a chosen region |
| Free tier, checked 2026-11-20 | 3,000 emails/month and 100/day. No overage on Free. Verify at https://resend.com/pricing | 100 emails/day, 1 custom domain, 1 day of logs. Verify at https://www.mailgun.com/pricing/ |
| Region | Multi-region sending is listed on every plan, including Free. Pick the region in the Resend dashboard. Do not invent region ids | US `smtp.mailgun.org`, EU `smtp.eu.mailgun.org`. AU `smtp.au.mailgun.org` is contract-only. Message data stays in the domain's region. Verify at https://documentation.mailgun.com/docs/mailgun/api-reference/api-overview |
| Port | Not used | 587 with STARTTLS. Mailgun also listens on 465, which requires TLS (`secure: true`). Do not set `secure: true` on 587 |

Adapter code, DNS, and `payload.sendEmail`: [references/email.md](references/email.md).

Copy SPF, DKIM, and DMARC from the provider's domain screen into the client's DNS. Do not invent TXT values. A domain may have one SPF TXT record; merge a new include into the existing record. Leave an existing DMARC `p=quarantine` or `p=reject` alone. If there is no DMARC record, add `_dmarc` with `p=none` and an `rua` mailbox the client reads, then tighten it after mail flows.

Send notifications from `after()` (imported from `next/server`) so a slow provider does not hold the visitor's response. Password reset uses the same adapter (the `payload-auth-rbac` skill).

## Step 2: One Google service account

Sheets, Drive, and Search Console share one service account. Create the project in Google Cloud, enable the Google Sheets API, Google Drive API, and Google Search Console API, then create a JSON key. Delete the downloaded file after the values are in `.env`. Never commit it.

Store two variables, not a base64 blob of the whole JSON:

```bash
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

`GOOGLE_PRIVATE_KEY` is the `private_key` value on one line, with newline characters written as `\n`. Vercel's env store keeps that single line. The client replaces `\\n` with real newlines before `google-auth-library` reads it. A base64 blob hides a broken key until runtime and is easier to paste into a log by accident. Code: [references/google.md](references/google.md).

Request only the scopes the project uses:

| Feature | Scope |
| --- | --- |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Drive uploads | `https://www.googleapis.com/auth/drive` |
| Search Console read | `https://www.googleapis.com/auth/webmasters.readonly` |
| Sitemap submit | `https://www.googleapis.com/auth/webmasters` |

`drive.file` does not see a folder a person created and then shared. The service account only reaches files shared with its email, so the broader Drive scope is the one that can upload into that folder.

Share the spreadsheet with `GOOGLE_CLIENT_EMAIL` as Editor. In Search Console, add that same email as a user on the property (Settings, Users and permissions). Sitemap submit needs a user who can manage the property. The console labels that role Full. Read-only query access is a lower role. Confirm the current labels in the Search Console UI before saving. Use the role that can submit a sitemap when the same client also calls `sitemaps.submit`.

## Step 3: Sheets

Append with `spreadsheets.values.append`, `valueInputOption: 'RAW'`, and `insertDataOption: 'INSERT_ROWS'`. `RAW` stores the text as entered and does not parse formulas (https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueInputOption). Also prefix cells that start with `=`, `+`, `-`, `@`, tab, or carriage return with a single quote, so a later export opened in Excel cannot execute them.

Put a header row in `Leads!A1` before the first submission. The append range is `Leads!A1`. Retry up to 3 times inside `after()`. On the last failure, log the lead id and the error name. Do not log the row. The visitor's request has already finished.

Column order is in the Google reference. It matches the lead document and omits `ipHash`.

## Step 4: Drive

Service accounts have no storage quota and cannot own files. Upload into a Shared Drive folder, with `supportsAllDrives: true` and that folder id in `parents`. A personal Gmail account cannot create a Shared Drive. If the client has no Google Workspace, stop and use Sheets for tabular data, or ask before switching the upload to a user OAuth client. Details: [references/google.md](references/google.md).

Source: https://developers.google.com/workspace/drive/api/guides/about-shareddrives

## Step 5: Search Console

Install `@googleapis/searchconsole` at the version in `versions.json`. The client is `searchconsole({ version: 'v1', auth })`.

Query with `searchanalytics.query` (`siteUrl`, `requestBody.startDate`, `endDate`, `dimensions`, `rowLimit`). Submit with `sitemaps.submit` (`siteUrl`, `feedpath`). `siteUrl` is the property exactly as Search Console shows it (`https://example.com/` or `sc-domain:example.com`). Dates are `YYYY-MM-DD` in Pacific Time. Data lags by a few days. A widget reads the top 10 queries for the last 28 days and nothing else.

Call this from a server component. Do not ship the Google client to the browser.

## Step 6: Turnstile

Install `@marsidev/react-turnstile` (pinned in `versions.json`). The widget prop is `siteKey`. Pass `options.action` of `lead_submit` (letters, digits, underscore). Verify on the server with `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` and JSON `{ secret, response, remoteip }`. Tokens last 300 seconds and are single-use. Check `hostname` and `action` in production. Test keys omit `action` and return hostname `example.com`, so skip those two checks when the secret is a documented test secret.

Local keys, from https://developers.cloudflare.com/turnstile/troubleshooting/testing/ :

| Role | Value |
| --- | --- |
| Site key, always passes, visible | `1x00000000000000000000AA` |
| Site key, always fails, visible | `2x00000000000000000000AB` |
| Secret, always passes | `1x0000000000000000000000000000000AA` |
| Secret, always fails | `2x0000000000000000000000000000000AA` |
| Secret, token already spent | `3x0000000000000000000000000000000AA` |

Production keys come from the Cloudflare dashboard. Test secrets reject real tokens, and production secrets reject dummy tokens. Implementation: [references/turnstile.md](references/turnstile.md).

## Environment variables

```bash
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEETS_LEAD_ID=
GOOGLE_DRIVE_FOLDER_ID=
SEARCH_CONSOLE_SITE_URL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Set Resend or SMTP, not both. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is the only value that may reach the browser.

## Stop and ask

- Which email provider, and the verified from-address.
- DNS access for SPF, DKIM, and DMARC.
- A Google Cloud project the client owns, the sheet share, and Search Console user access.
- A Shared Drive folder before any Drive upload.
- Production Turnstile keys. Do not ship the test secret.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Mail accepted, never arrives | Domain not verified, or SPF has two TXT records | Step 1 |
| `Invalid key` from Google | The private key still contains the two characters `\` and `n` | The newline split in the Google reference |
| Sheets `403` | The sheet is not shared with the service account email | Step 2 |
| Drive `storageQuotaExceeded` | Upload went to the service account's My Drive | Step 4 |
| Turnstile always fails locally | Production secret with a test site key, or the reverse | Step 6 table |
| Search Console `403` | The service account is not a user on that property | Step 2 |

## Done when

- [ ] A test message to an inbox you control shows SPF pass and DKIM pass
- [ ] A lead row appears in the sheet, and a value that looks like `=1+1` is stored as text
- [ ] The local form passes with the always-pass test keys, and the always-fail secret rejects a token
- [ ] Search Console widget renders, or the step is skipped in `PROJECT.md` because the property is not verified yet
- [ ] No Google credential, Turnstile secret, or full lead row appears in logs
