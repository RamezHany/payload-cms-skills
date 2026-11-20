# Google Calendar, Meet, and ICS

Packages from `versions.json`: `@googleapis/calendar` and `google-auth-library`. ICS files use `ics`. All of this is server-only, in `src/lib/google.ts` and `src/features/payments/fulfill.ts`.

Ask which row applies before writing credentials. A personal Gmail account and a Workspace domain are different products.

## Auth

| Account | Choice | Why |
| --- | --- | --- |
| Personal Gmail | OAuth client plus a refresh token, `GOOGLE_AUTH_MODE=oauth` | The consultant owns the calendar |
| Google Workspace | Service account with domain-wide delegation, `subject` set to the calendar owner, `GOOGLE_AUTH_MODE=workspace` | The owner is a user in the domain |

Scope for both: `https://www.googleapis.com/auth/calendar`.

### OAuth (personal Gmail)

```ts
import { OAuth2Client } from 'google-auth-library'

const auth = new OAuth2Client(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
)
auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN })
```

The refresh token is produced once, outside this skill, with offline access and that scope, and stored in `.env`. Do not build an interactive consent UI unless the client asks.

Google's OAuth documentation: a Cloud project whose consent screen is an external user type and whose publishing status is Testing issues a refresh token that expires in 7 days, unless the only scopes are name, email, and profile. The calendar scope is not in that set. While the app stays in Testing, the calendar connection dies every week. Publish the consent screen to Production before go-live, or use the Workspace row. Warn the client in `PROJECT.md`.

### Workspace service account

```ts
import { JWT } from 'google-auth-library'

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').split('\\n').join('\n'),
  scopes: ['https://www.googleapis.com/auth/calendar'],
  subject: process.env.GOOGLE_CALENDAR_OWNER_EMAIL,
})
```

A Workspace admin must authorize the service account's client id for the calendar scope (domain-wide delegation). `subject` is the mailbox that owns the calendar.

Google's events resource: service accounts need domain-wide delegation to populate `attendees`. A plain service account, with no `subject`, can write a calendar it has been shared on and still cannot invite guests. Do not use that mode for this skill. If delegation is refused, create the event without `attendees` and keep the customer only on our ICS email. Record that limitation in `PROJECT.md`.

## Client

```ts
import { calendar } from '@googleapis/calendar'

export const calendarClient = calendar({ version: 'v3', auth })
```

`GOOGLE_CALENDAR_ID` is the calendar id, or `primary` for the impersonated user's primary calendar.

## Freebusy

Used by the slot route. Failure returns 503 from that route.

```ts
const response = await calendarClient.freebusy.query({
  requestBody: {
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    timeZone: settings.timezone,
    items: [{ id: process.env.GOOGLE_CALENDAR_ID || 'primary' }],
  },
})
```

Read `calendars[calendarId].busy`. Each entry is `{ start, end }` in RFC3339. Treat `[start, end + bufferMinutes)` as occupied. An `errors` entry on that calendar is a failure, not an empty day.

## Create the Meet event

Run this inside `after()`, and only after a compare-and-set changed one booking. If `calendarEventId` is already set, return.

`events.insert` parameters that matter:

| Parameter | Value |
| --- | --- |
| calendarId | `GOOGLE_CALENDAR_ID` or `primary` |
| conferenceDataVersion | `1`. Version 0 ignores `conferenceData`. Allowed values are 0 and 1 |
| sendUpdates | `none`. We send the ICS email ourselves. Google warns that `none` can skip syncing the event to some external calendars. The customer still receives our email. Do not also set `sendUpdates` to `all`, or the customer gets two messages |
| requestBody.summary | Service title plus the site name |
| requestBody.start / end | `dateTime` as UTC ISO (`...Z`) and `timeZone: 'UTC'`. Do not pair a Zulu `dateTime` with the business zone. Google reads `dateTime` in `timeZone` and will shift the meeting |
| requestBody.attendees | `[{ email: booking.email }]` when the auth mode can invite |
| requestBody.conferenceData.createRequest.requestId | `publicToken`. Reusing a request id makes Google ignore the new request. One booking, one id |
| requestBody.conferenceData.createRequest.conferenceSolutionKey.type | `hangoutsMeet` |

Meet data is created asynchronously. If the insert response has no video entry point, call `events.get` once for that event id. Read `conferenceData.entryPoints` where `entryPointType` is `video`, and store `uri` in `meetUrl`. If it is still pending, store `calendarEventId` and send the email without a Meet link rather than looping.

Store `data.id` in `calendarEventId` before sending the email. A retry then sees the id and does not insert a second event.

## ICS email

`createEvent` from `ics` returns `{ error, value }` when called without a callback. The `start` array is calendar components, and the month is 1-based (January is 1), not `Date#getUTCMonth()`.

```ts
import { createEvent } from 'ics'

const start = new Date(booking.startsAt)
const { error, value } = createEvent({
  start: [
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
    start.getUTCHours(),
    start.getUTCMinutes(),
  ],
  startInputType: 'utc',
  startOutputType: 'utc',
  duration: { minutes: durationMinutes },
  title: serviceTitle,
  description: meetUrl ? `Join: ${meetUrl}` : serviceTitle,
  url: meetUrl,
  status: 'CONFIRMED',
  organizer: { name: siteName, email: organizerEmail },
  attendees: [{ name: booking.customerName, email: booking.email, rsvp: true }],
})
```

`start` or `end` is required by the package, and `duration` replaces `end`. Do not pass both. `value` is the ICS string.

Send it with the email helper defined by `payload-integrations`:

- To `booking.email`
- Copy to the calendar owner
- Subject and body from the messages for `booking.locale`
- Attachment filename `booking.ics`, content type `text/calendar`
- Include the Meet URL in the body when `meetUrl` is set

Format the displayed time with `Intl.DateTimeFormat(booking.locale, { timeZone: settings.timezone, dateStyle: 'full', timeStyle: 'short' })`.

Admin mail for `needs_refund` goes to the site contact address from site settings, not to the customer, and it contains the booking id and provider event id only.

## Common errors

| Symptom | Cause |
| --- | --- |
| `invalid_grant` a week after setup | OAuth app still in Testing. Publish it, or switch to Workspace |
| Attendees rejected | Service account without `subject` and domain-wide delegation |
| Event created, no Meet URL | `conferenceDataVersion` omitted (defaults to 0), or `requestId` reused |
| Meeting an hour off | `dateTime` with `Z` combined with the business `timeZone` |
| Two invitations | `sendUpdates: 'all'` plus our ICS email |
