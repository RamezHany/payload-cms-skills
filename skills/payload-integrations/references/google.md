# Google Sheets, Drive, and Search Console

Packages in `versions.json`: `@googleapis/sheets` 18.1.3, `@googleapis/drive` 27.1.0, `@googleapis/searchconsole` 11.0.1, `google-auth-library` 11.3.4.

## Auth

`src/lib/google.ts` starts with `import 'server-only'`.

```ts
import 'server-only'

import { Readable } from 'node:stream'

import { JWT } from 'google-auth-library'
import { drive } from '@googleapis/drive'
import { searchconsole } from '@googleapis/searchconsole'
import { sheets } from '@googleapis/sheets'

import { escapeSpreadsheetCell } from '@/utilities/escapeSpreadsheet'
import { getPayloadClient } from '@/lib/payload'

export function privateKey(): string {
  const raw = process.env.GOOGLE_PRIVATE_KEY ?? ''
  const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
  return unquoted.split('\\n').join('\n')
}

function googleJwt(scopes: string[]): JWT {
  return new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey(),
    scopes,
  })
}
```

`JWT` takes `email`, `key`, and `scopes` (`google-auth-library` 11.3.4). Do not pass `keyFile`. The key file is not on the server.

Do not log `privateKey()` or the client email together with a request. Log "Google credentials are missing" when either env var is empty, and return.

## Sheets

```ts
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export async function appendLeadRow(leadId: number | string): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_LEAD_ID
  if (!spreadsheetId || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) return

  const payload = await getPayloadClient()
  const lead = await payload.findByID({ collection: 'leads', id: leadId, depth: 0, overrideAccess: true })
  if (!lead) return

  const row = [
    lead.createdAt,
    lead.locale,
    lead.source,
    lead.name,
    lead.email,
    lead.phone ?? '',
    lead.message,
    lead.pageUrl ?? '',
    lead.utmSource ?? '',
    lead.utmMedium ?? '',
    lead.utmCampaign ?? '',
    lead.utmTerm ?? '',
    lead.utmContent ?? '',
    lead.status,
  ].map(escapeSpreadsheetCell)

  const client = sheets({ version: 'v4', auth: googleJwt([SHEETS_SCOPE]) })
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: 'Leads!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    }
  }
  payload.logger.error(`lead ${leadId} sheet append failed: ${lastError instanceof Error ? lastError.name : 'error'}`)
}
```

Header row, in this order: created at, locale, source, name, email, phone, message, page URL, utm source, utm medium, utm campaign, utm term, utm content, status. The person who owns the sheet writes that header once. Append finds the table at `Leads!A1`.

`valueInputOption: 'RAW'` is the Sheets enum that stores values without parsing. `INSERT_ROWS` inserts a row instead of overwriting the next blank-looking cells. Both are in the spreadsheets.values.append reference.

The `escapeSpreadsheet` helper lives in the `payload-forms-crm` skill. If this file is added first, copy that helper into `src/utilities/escapeSpreadsheet.ts` before importing it.

## Drive

```ts
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

export async function uploadToSharedDrive(filename: string, mimeType: string, body: Buffer): Promise<string | null> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) return null

  const client = drive({ version: 'v3', auth: googleJwt([DRIVE_SCOPE]) })
  const created = await client.files.create({
    supportsAllDrives: true,
    fields: 'id',
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(body) },
  })
  return created.data.id ?? null
}
```

`folderId` is a folder inside a Shared Drive, and the service account is a member of that drive (Contributor or Content manager). `supportsAllDrives: true` is required for shared drives (`drive.files.create` in `@googleapis/drive` 27.1.0). Uploading with no parent lands in the service account's My Drive, which has no quota and returns a storage error.

Do not use this for images on the public site. Those use the `payload-media` skill. Drive here is for an export file or a lead attachment the client asked to archive.

## Search Console

```ts
const WEBMASTERS_SCOPE = 'https://www.googleapis.com/auth/webmasters'

export async function topQueries(): Promise<{ query: string; clicks: number; impressions: number }[]> {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL
  if (!siteUrl) return []

  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 3)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 28)
  const day = (date: Date) => date.toISOString().slice(0, 10)

  const client = searchconsole({ version: 'v1', auth: googleJwt([WEBMASTERS_SCOPE]) })
  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: day(start),
      endDate: day(end),
      dimensions: ['query'],
      rowLimit: 10,
      type: 'web',
    },
  })

  return (response.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
  }))
}

export async function submitSitemap(feedpath: string): Promise<void> {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL
  if (!siteUrl) return
  const client = searchconsole({ version: 'v1', auth: googleJwt([WEBMASTERS_SCOPE]) })
  await client.sitemaps.submit({ siteUrl, feedpath })
}
```

`searchanalytics.query` and `sitemaps.submit` are the method names on `@googleapis/searchconsole` 11.0.1. `requestBody`, `siteUrl`, and `feedpath` match that package's types. `rowLimit` max is 25000; this widget asks for 10. Query dates are Pacific Time on Google's side; shifting the window back three days avoids an empty "today".

Read-only widgets can use `https://www.googleapis.com/auth/webmasters.readonly` instead of `webmasters`. Sitemap submit requires `webmasters`. One JWT lists every scope that call needs. Do not reuse a Drive-scoped client for Search Console.

Render `topQueries()` from a server component behind admin auth. Cache it with `unstable_cache` and a tag that is not shared with content queries, for example `search-console-widget`, and revalidate that tag on a timer (`revalidate: 86400`) rather than on every lead or post save. Do not call `revalidatePath` for this widget.

`submitSitemap` is a manual admin action or a post-deploy step, not a per-request call. The sitemap URL must already return XML. `feedpath` is the full sitemap URL.
