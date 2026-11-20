# Security headers

Add `headers()` to the existing object in `next.config.ts`. Do not replace the file. The next-intl plugin, image config, and anything else already there stay. `headers` may be async. Official shape: https://nextjs.org/docs/app/api-reference/config/next-config-js/headers

`X-Frame-Options` is omitted on purpose. Next's header docs say `frame-ancestors` replaces it. `DENY` makes the live preview iframe blank. `SAMEORIGIN` is redundant next to `frame-ancestors 'self'`.

HSTS is sent only when the build is a production deployment. `next.config.ts` runs at build time, and `VERCEL_ENV` is available then. Sending HSTS from a local or preview build can stick in a browser.

```ts
import type { NextConfig } from 'next'

const isProduction = process.env.VERCEL_ENV === 'production'

// Leading space when non-empty. Empty string when that feature is off.
const scriptSources = ''
const imageSources = ''
const frameSources = ''
const connectSources = ''
const formActionSources = ''

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${scriptSources}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${imageSources}`,
  `frame-src 'self'${frameSources}`,
  "frame-ancestors 'self'",
  `connect-src 'self'${connectSources}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self'${formActionSources}`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

// Add headers() to the existing NextConfig object. Keep the export that wraps it
// (for example withNextIntl). Do not drop image or plugin settings already in the file.
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
```

Fill each `*Sources` string from the table below. A non-empty value starts with a space, for example `' https://res.cloudinary.com'`. `'unsafe-inline'` stays: the Payload admin and Next.js without a nonce setup both need it. Do not add `'unsafe-eval'` unless the browser console names it. Do not add a host that the table does not list and the console does not block.

The `Permissions-Policy` value is the one in the Next.js headers docs. `X-Content-Type-Options: nosniff` is the only valid value that page documents. HSTS `max-age=63072000; includeSubDomains` is that page's example without the `preload` token. Omit `preload` unless the client asks to submit the domain to the preload list; leaving the list later is slow.

## Hosts

Add the host only when that feature is in `PROJECT.md`.

| Feature | Directive | Host |
| --- | --- | --- |
| Cloudinary images | `img-src` | `https://res.cloudinary.com` |
| Cloudinary direct upload from the admin | `connect-src` | `https://api.cloudinary.com` |
| R2 | `img-src` and `connect-src` | the exact host of `R2_PUBLIC_URL`, and the bucket endpoint host (`https://<accountid>.r2.cloudflarestorage.com`) |
| Mux | `img-src` and `frame-src` | `https://image.mux.com` and `https://stream.mux.com`. Add any further host the browser blocks when a video plays. |
| YouTube facade | `frame-src` and `img-src` | `https://www.youtube-nocookie.com` and `https://i.ytimg.com` |
| Turnstile | `script-src`, `frame-src`, and `connect-src` | `https://challenges.cloudflare.com` |
| Google Analytics or Tag Manager, after consent | `script-src` and `connect-src` | `https://www.googletagmanager.com` and `https://www.google-analytics.com` |
| Stripe.js in the browser | `script-src` and `frame-src` | `https://js.stripe.com` |
| A gateway that the browser posts a form to | `form-action` | the host `payload-bookings-payments` documents for that gateway |

The browser does not connect to Turso. Do not add the database host to `connect-src`.

After the first production deploy, load `/`, `/admin`, and a page that uses each enabled third party. For each console message that names a blocked host, add that host to the one directive the message names. Do not widen `default-src`.

## Check

```bash
curl.exe -sI https://<production-domain>
```

The status is 200. The headers include the five names in the deploy skill's launch checklist. `content-security-policy` contains `frame-ancestors 'self'`. `x-frame-options`, if some other layer adds it, is not `DENY`.
