# Turnstile

Official validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

Official test keys: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

The widget package is `@marsidev/react-turnstile` 1.6.3. The component is `Turnstile`. The site key prop is `siteKey`. `onSuccess` receives the token. `options.action`, `options.theme`, and `options.size` are the render options. A ref exposes `reset()`, `getResponse()`, and `isExpired()`. The form in the `payload-forms-crm` skill uses that ref.

## Server check

`src/lib/turnstile.ts`

```ts
import 'server-only'

type Siteverify =
  | { success: true; hostname?: string; action?: string }
  | { success: false; 'error-codes'?: string[] }

const TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
])

export async function verifyTurnstile(token: string, remoteIp: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || token.length === 0 || token.length > 2048) return false

  let result: Siteverify
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: remoteIp }),
    })
    result = (await response.json()) as Siteverify
  } catch {
    return false
  }

  if (!result.success) return false
  if (TEST_SECRETS.has(secret)) return true

  const host = process.env.NEXT_PUBLIC_SERVER_URL ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname : ''
  if (!host || result.hostname !== host) return false
  if (result.action !== 'lead_submit') return false
  return true
}
```

`secret`, `response`, and `remoteip` are the Siteverify fields. `remoteip` is optional. The token's maximum length is 2048 characters. It expires 300 seconds after it is issued. A second validation returns `timeout-or-duplicate` once the first redemption has propagated. Reset the widget after every submit so the next attempt gets a new token.

Test secrets always report hostname `example.com` and omit `action`. Skip the hostname and action checks for those three documented secrets only. Production must compare `hostname` to the site host from `NEXT_PUBLIC_SERVER_URL`, not to a host the browser sent, and must compare `action` to `lead_submit`.

Do not log the token or the secret. On failure the caller returns `verification_failed`. The visitor sees the translated sentence from the form, not the Cloudflare error code.

Local `.env`:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

To test the failure path, switch the secret to `2x0000000000000000000000000000000AA` and submit again. Switch it back before sharing the environment. Production uses the keys from the Cloudflare widget, and the widget's hostname list includes the production domain. Dummy keys work on localhost. Production keys should not allow localhost.
