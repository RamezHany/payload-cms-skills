# Environment variables

Set these in the Vercel project for the environments in the table. Names match the `payload-bootstrap` skill and the `payload-media` skill. Email, Google, payment, and Turnstile variables use the names those features already document. If a feature is not in the project, do not invent the variable.

`NEXT_PUBLIC_` values are baked into the client bundle at build time. Everything else stays on the server.

System variables Vercel provides (enable "System Environment Variables" if the project settings show that checkbox): https://vercel.com/docs/environment-variables/system-environment-variables

| Variable | Available | Notes |
| --- | --- | --- |
| `VERCEL_ENV` | build and runtime | `production`, `preview`, or `development` |
| `VERCEL_URL` | build and runtime | Hostname only, no `https://`. This deployment's URL. |
| `VERCEL_PROJECT_PRODUCTION_URL` | build and runtime | Production hostname, set on preview deployments too. Do not use it as the preview admin origin. |

## Application variables

| Name | Public | Production | Preview | Development |
| --- | --- | --- | --- | --- |
| `PAYLOAD_SECRET` | no | long random | different random | local random |
| `DATABASE_URL` | no | `libsql://` of `<project>-prod` | `libsql://` of `<project>-preview` | `file:./payload.db` |
| `DATABASE_AUTH_TOKEN` | no | prod token | preview token | empty |
| `NEXT_PUBLIC_SERVER_URL` | yes | `https://<production-domain>` | unset | `http://localhost:3000` |
| `PREVIEW_SECRET` | no | random | can match production | local random |
| `CRON_SECRET` | no | random, header-safe | unset unless you invoke the route there | local random |
| `CLOUDINARY_CLOUD_NAME` | no | set | set if preview uploads | set |
| `CLOUDINARY_API_KEY` | no | set | same rule | set |
| `CLOUDINARY_API_SECRET` | no | set | same rule | set |
| `CLOUDINARY_FOLDER` | no | folder name | a preview folder if you want uploads separated | folder name |
| `R2_ACCOUNT_ID` | no | set when using R2 | set | set |
| `R2_BUCKET` | no | set | set | set |
| `R2_ACCESS_KEY_ID` | no | set | set | set |
| `R2_SECRET_ACCESS_KEY` | no | set | set | set |
| `R2_PUBLIC_URL` | no | `https://media.<domain>` | set | set |
| `MUX_TOKEN_ID` | no | set when using Mux | set | set |
| `MUX_TOKEN_SECRET` | no | set | set | set |
| `MUX_WEBHOOK_SIGNING_SECRET` | no | production webhook secret | unset | local |
| `RESEND_API_KEY` | no | set when Resend is the email provider | unset unless preview sends mail | local |
| `EMAIL_FROM_ADDRESS` | no | set with Resend | same rule | local |
| `EMAIL_FROM_NAME` | no | set with Resend | same rule | local |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | no | set when SMTP is the email provider, instead of Resend | unset | local |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | no | live keys when Stripe is enabled | unset | test keys |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` | no | live when PayPal is enabled. `PAYPAL_MODE=live` | unset | sandbox, `PAYPAL_MODE=sandbox` |
| `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_IDS` | no | live when Paymob is enabled. `PAYMOB_PUBLIC_KEY` is not a `NEXT_PUBLIC_` variable | unset | test keys |
| `KASHIER_MERCHANT_ID`, `KASHIER_SECRET_KEY`, `KASHIER_API_KEY` | no | live, `KASHIER_MODE=live` | unset | `KASHIER_MODE=test` |
| `FAWRY_MERCHANT_CODE`, `FAWRY_SECURE_KEY`, `FAWRY_MODE` | no | the mode string the provider file uses for `https://www.atfawry.com`. Development uses `sandbox` | unset | `sandbox` |
| `TAP_SECRET_KEY` | no | live when Tap is enabled | unset | test key |
| `GOOGLE_AUTH_MODE` | no | `service-account` or `oauth` for Sheets, Drive, and Search Console | unset | local |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` | no | service-account credential. Leave empty when the mode is oauth | unset | local |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` | no | oauth credential. Leave empty when the mode is service-account | unset | local |
| `GOOGLE_CALENDAR_AUTH_MODE` | no | `service-account` or `oauth`, independent of `GOOGLE_AUTH_MODE` | unset | local |
| `GOOGLE_CALENDAR_CLIENT_EMAIL`, `GOOGLE_CALENDAR_PRIVATE_KEY` | no | only when the calendar service account is a different key | unset | local |
| `GOOGLE_CALENDAR_OAUTH_CLIENT_ID`, `GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET`, `GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN` | no | only when the calendar OAuth user is not the Sheets user | unset | local |
| `GOOGLE_CALENDAR_OWNER_EMAIL`, `GOOGLE_CALENDAR_ID` | no | delegation subject for service-account calendar, and the calendar id (`primary` is allowed) | unset | local |
| `TURNSTILE_SECRET_KEY` | no | production secret | unset | a documented test secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | yes | production site key | production or test site key | documented test site key |

Generate random secrets with `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`. `CRON_SECRET` must be valid inside an HTTP header: letters and numbers, no spaces or line breaks. The cron docs ask for at least 16 characters. A 32-byte hex string satisfies that.

Never enable the production database variables for Preview. In the Vercel UI that means the Production checkbox only. The preview token is a different token from `turso db tokens create <project>-preview`.

A `file:` URL on Vercel fails. The filesystem is read-only and is discarded on the next deploy. The `payload-bootstrap` skill states this.

## Origin used by Payload

`NEXT_PUBLIC_SERVER_URL` is wrong for preview, because the preview hostname changes and the value would point at production. Resolve the server origin in `src/payload.config.ts`:

```ts
function resolveServerURL(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL
  if (configured) return configured

  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  return 'http://localhost:3000'
}
```

Pass that string to `serverURL`, and pass `[serverURL]` to both `cors` and `csrf`. On Production, `NEXT_PUBLIC_SERVER_URL` is set, so the custom domain wins over `VERCEL_PROJECT_PRODUCTION_URL`. On Preview it is unset, so the deployment hostname is used. On a laptop, the localhost value in `.env` is used.

Client components do not read this function. They use `window.location.origin`, as the `payload-live-preview` skill requires. A client component that reads `NEXT_PUBLIC_SERVER_URL` on a preview deployment gets an empty string and must fall back to the window origin.
