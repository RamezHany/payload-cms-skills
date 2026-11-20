# Video

## Choose a provider

| Need | Provider | Cost model |
| --- | --- | --- |
| Professional playback, analytics, private videos | Mux | Usage-based with a free allowance; check the current plan |
| Zero cost, public or unlisted marketing videos | Vimeo (free plan) or unlisted YouTube | Free; provider branding applies |
| Short decorative loops (under 5 seconds, muted) | MP4/WebM in R2 or Cloudinary | Storage only |

## Mux with `@oversightstudio/mux-video`

The plugin adds a `mux-video` collection. Editors upload from the admin; the browser sends the file directly to Mux, so Vercel limits do not apply.

1. Install `@oversightstudio/mux-video` and `@mux/mux-player-react`.
2. In the Mux dashboard, create an access token (Mux Video read and write) and a webhook pointing to `https://<domain>/api/mux/webhook`. Copy the webhook signing secret.
3. Add to `src/plugins/index.ts`:

```ts
import { muxVideoPlugin } from '@oversightstudio/mux-video'

muxVideoPlugin({
  enabled: true,
  initSettings: {
    tokenId: process.env.MUX_TOKEN_ID || '',
    tokenSecret: process.env.MUX_TOKEN_SECRET || '',
    webhookSecret: process.env.MUX_WEBHOOK_SIGNING_SECRET || '',
  },
  uploadSettings: {
    cors_origin: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  },
}),
```

4. Link videos from other collections with a relationship field: `{ name: 'video', type: 'relationship', relationTo: 'mux-video' }`.
5. Webhooks cannot reach `localhost`. For local testing, upload on a deployed environment or use a tunnel; otherwise assets stay in "preparing".

For private videos (paid courses, client-only content), use the signed playback setup from the plugin README: add `jwtSigningKey` and `jwtPrivateKey` to `initSettings` and `new_asset_settings: { playback_policy: ['signed'] }` to `uploadSettings`.

### Player

```tsx
'use client'

import MuxPlayer from '@mux/mux-player-react/lazy'

type Props = { playbackId: string; title: string; aspectRatio?: string }

export function VideoPlayer({ playbackId, title, aspectRatio = '16 / 9' }: Props) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      metadata={{ video_title: title }}
      streamType="on-demand"
      style={{ aspectRatio }}
      loading="viewport"
    />
  )
}
```

The `lazy` entry point loads the player code only when the element nears the viewport.

## Vimeo or unlisted YouTube

Store the URL in a text field with Zod-backed validation on any frontend form (`z.url()`), and render a facade that loads the provider iframe only on click.

YouTube: use `react-lite-youtube-embed` (it uses `youtube-nocookie.com`):

```tsx
'use client'

import LiteYouTubeEmbed from 'react-lite-youtube-embed'
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'

function youtubeId(url: string): string | null {
  const parsed = new URL(url)
  if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1) || null
  return parsed.searchParams.get('v')
}

export function YouTubeVideo({ url, title }: { url: string; title: string }) {
  const id = youtubeId(url)
  if (!id) return null
  return <LiteYouTubeEmbed id={id} title={title} noCookie />
}
```

Vimeo: render the poster image with a play button; on click, replace it with `<iframe src="https://player.vimeo.com/video/<id>?autoplay=1&dnt=1" allow="autoplay; fullscreen; picture-in-picture" />`. Get the poster from Vimeo's oEmbed endpoint on the server (`https://vimeo.com/api/oembed.json?url=<video url>`) and cache it with the page.

## Rules

- Never autoplay with sound. Autoplaying background loops must be `muted`, `playsInline`, `loop`, and paused when `prefers-reduced-motion` is set.
- Always set an aspect ratio so the layout does not shift when the player loads.
- Captions: Mux supports auto-generated captions; enable them for accessibility when the plan allows.
