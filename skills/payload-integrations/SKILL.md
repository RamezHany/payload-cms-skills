---
name: payload-integrations
description: Email, Google Sheets, Drive, and Search Console, plus Cloudflare Turnstile, for Payload CMS 3 sites on Vercel. Resend or Mailgun, Google auth by service account or OAuth, formula-safe sheet appends, Drive uploads, a small Search Console widget, and Turnstile siteverify. Use when sending email, appending leads to a spreadsheet, uploading to Drive, reading Search Console, or adding a captcha.
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

## Step 2: Choose Google auth

Sheets, Drive, and Search Console share one mode. Calendar chooses its own mode in the `payload-bookings-payments` skill, because the calendar owner is often a different Google account. Record both choices in `PROJECT.md`.

| Mode | `GOOGLE_AUTH_MODE` | When |
| --- | --- | --- |
| Service account | `service-account` | The client has Google Workspace, or a Cloud project they can share with a robot user |
| OAuth | `oauth` | A person owns the sheet, the Drive folder, or the Search Console property, and there is no Workspace |

Enable the Google Sheets API, Google Drive API, and Google Search Console API on the Cloud project. For `service-account`, create a JSON key, copy `client_email` and `private_key`, then delete the downloaded file. For `oauth`, create an OAuth client and mint one refresh token offline with the scopes below. Do not build a consent screen in the website unless the client asks. Never commit either credential.

```bash
GOOGLE_AUTH_MODE=service-account
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
```

Fill the pair that matches the mode. Leave the other pair empty. `GOOGLE_PRIVATE_KEY` is the `private_key` value on one line, with newline characters written as `\n`. Vercel's env store keeps that single line. The client replaces `\\n` with real newlines before `google-auth-library` reads it. A base64 blob hides a broken key until runtime and is easier to paste into a log by accident. Code: [references/google.md](references/google.md).

A Cloud project whose consent screen is an external user type and whose publishing status is Testing issues a refresh token that expires in 7 days, unless the only scopes are name, email, and profile. These scopes are not in that set. While the app stays in Testing, an `oauth` connection dies every week. Publish the consent screen to Production before go-live, or use `service-account`. Warn the client in `PROJECT.md`.

Request only the scopes the project uses:

| Feature | Scope |
| --- | --- |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Drive uploads | `https://www.googleapis.com/auth/drive` |
| Search Console read | `https://www.googleapis.com/auth/webmasters.readonly` |
| Sitemap submit | `https://www.googleapis.com/auth/webmasters` |

`drive.file` does not see a folder a person created and then shared. The service account only reaches files shared with its email, so the broader Drive scope is the one that can upload into that folder.

Who must already have access depends on the mode:

| Mode | Sheets | Drive | Search Console |
| --- | --- | --- | --- |
| `service-account` | Share the spreadsheet with `GOOGLE_CLIENT_EMAIL` as Editor | The service account is a member of the Shared Drive | Add that same email as a user on the property |
| `oauth` | The Google user who minted the refresh token can edit the sheet | That user can write the folder | That user is already on the property |

Sitemap submit needs a user who can manage the property. The console labels that role Full. Read-only query access is a lower role. Confirm the current labels in the Search Console UI before saving. Use the role that can submit a sitemap when the same client also calls `sitemaps.submit`. Do not invite a service account when the mode is `oauth`.

## Step 3: Sheets

Append with `spreadsheets.values.append`, `valueInputOption: 'RAW'`, and `insertDataOption: 'INSERT_ROWS'`. `RAW` stores the text as entered and does not parse formulas (https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueInputOption). Also prefix cells that start with `=`, `+`, `-`, `@`, tab, or carriage return with a single quote, so a later export opened in Excel cannot execute them.

Put a header row in `Leads!A1` before the first submission. The append range is `Leads!A1`. Retry up to 3 times inside `after()`. On the last failure, log the lead id and the error name. Do not log the row. The visitor's request has already finished.

Column order is in the Google reference. It matches the lead document and omits `ipHash`.

## Step 4: Drive

`service-account` has no storage quota and cannot own files. That mode uploads into a Shared Drive folder (`supportsAllDrives: true`, folder id in `parents`). A personal Gmail account cannot create a Shared Drive, so use `oauth` for that client and upload into a folder that user can write. Details: [references/google.md](references/google.md).

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
GOOGLE_AUTH_MODE=service-account
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
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
- Which Google mode, `service-account` or `oauth`, and a Cloud project the client owns.
- Sheet access and Search Console access for the account that mode uses.
- A Shared Drive folder before a `service-account` Drive upload. An `oauth` upload needs a folder that user can write.
- Production Turnstile keys. Do not ship the test secret.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| Mail accepted, never arrives | Domain not verified, or SPF has two TXT records | Step 1 |
| `Invalid key` from Google | The private key still contains the two characters `\` and `n` | The newline split in the Google reference |
| Sheets `403` | `service-account`: the sheet is not shared with the client email. `oauth`: the refresh-token user cannot edit the sheet | Step 2 |
| Drive `storageQuotaExceeded` | A service account upload went to My Drive instead of a Shared Drive | Step 4 |
| Turnstile always fails locally | Production secret with a test site key, or the reverse | Step 6 table |
| Search Console `403` | `service-account`: that email is not a user on the property. `oauth`: the refresh-token user is not on the property | Step 2 |

## Done when

- [ ] A test message to an inbox you control shows SPF pass and DKIM pass
- [ ] A lead row appears in the sheet, and a value that looks like `=1+1` is stored as text
- [ ] The local form passes with the always-pass test keys, and the always-fail secret rejects a token
- [ ] Search Console widget renders, or the step is skipped in `PROJECT.md` because the property is not verified yet
- [ ] No Google credential, Turnstile secret, or full lead row appears in logs
