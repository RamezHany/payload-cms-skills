---
name: payload-media
description: Media handling for Payload CMS 3 on Vercel - direct browser-to-storage uploads (Cloudinary, Cloudflare R2, S3) that bypass the 4.5 MB serverless body limit, in-browser WebP compression before upload, responsive images without burning image optimization quotas, and video through Mux, Vimeo, or unlisted YouTube. Use when configuring the media collection, uploads fail or time out on Vercel, images are heavy, or the site needs video.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload media

On Vercel, a request body larger than 4.5 MB fails before it reaches Payload, and functions have a time limit. Files must therefore go straight from the editor's browser to storage, never through a serverless function.

## Step 1: Choose storage

| Need | Choice | Why |
| --- | --- | --- |
| Images with automatic resizing and formats (default) | Cloudinary via `payload-cloudinary` | Signed direct uploads, URL-based transformations, free tier |
| Lowest cost, many large files, PDFs | Cloudflare R2 via `@payloadcms/storage-s3` | Free egress, free storage tier, direct uploads |
| Client already on AWS | S3 via `@payloadcms/storage-s3` | Same adapter as R2 |
| Video | Mux via `@oversightstudio/mux-video` | Direct uploads to Mux, adaptive streaming |
| Video at zero cost | Vimeo or unlisted YouTube URL field | No upload infrastructure |

Never use local disk storage in production: Vercel's filesystem is read-only and resets on deploy. Never use `@payloadcms/storage-r2` on Vercel; it is for Cloudflare Workers deployments. Record the choice in `PROJECT.md`.

## Step 2: Configure the storage plugin

### Cloudinary (default)

Install `payload-cloudinary` (it requires `@payloadcms/plugin-cloud-storage` at the Payload version). Add to `src/plugins/index.ts`:

```ts
import { cloudinaryStorage } from 'payload-cloudinary'

cloudinaryStorage({
  config: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
  },
  collections: { media: true },
  folder: process.env.CLOUDINARY_FOLDER || 'site-media',
  clientUploads: true,
}),
```

`clientUploads: true` makes the browser request a signed upload from the server and send the file directly to Cloudinary. The API secret never reaches the browser.

### Cloudflare R2 or S3

Follow [references/storage-r2-s3.md](references/storage-r2-s3.md). It includes the bucket CORS rules that direct uploads need.

## Step 3: The media collection

Start from the template's `src/collections/Media.ts` and apply these rules:

1. `alt` is a required, localized text field. Editors must describe every image.
2. Remove `imageSizes` and set `crop: false`. Responsive sizes come from Cloudinary transformations or the image loader in Step 5, which keeps saves fast and inside function time limits.
3. Keep `focalPoint: true`; use `focalX` and `focalY` for `object-position` on the frontend.
4. Restrict `mimeTypes` to what the site uses, for example `['image/*', 'application/pdf']`.
5. Access: `read` public, `create`/`update`/`delete` for authenticated users with an editor role (`payload-auth-rbac`).
6. `folders: true` helps editors organize large libraries.

## Step 4: Compress images in the browser before upload

1. Copy [assets/optimizeImage.ts](assets/optimizeImage.ts) and [assets/OptimizedUpload.tsx](assets/OptimizedUpload.tsx) into `src/components/admin/OptimizedUpload/`.
2. Register the component on the media collection:

```ts
admin: {
  components: {
    edit: {
      Upload: '@/components/admin/OptimizedUpload/OptimizedUpload#OptimizedUpload',
    },
  },
},
```

3. Run `pnpm generate:importmap`.

What it does: when an editor selects a JPEG, PNG, or WebP image, it is resized to at most 2560 px on the long edge, re-encoded as WebP at quality 0.82, and swapped into the form before upload. SVG and GIF files are untouched. If the browser cannot encode WebP (older Safari), JPEGs fall back to a resized JPEG and other formats upload unchanged. If the result is not smaller, the original uploads.

Limits:

- Bulk upload uses a separate form and skips this step. Cloudinary still serves optimized sizes; for R2, ask editors to upload large photos one at a time.
- An editor who saves within a second of selecting a very large image may upload the original. That is safe, just larger.

## Step 5: Render images on the frontend

Use `next/image` everywhere with `sizes` set. Configure a loader so resizing happens at the storage CDN instead of consuming Vercel's image optimization quota:

`src/utilities/imageLoader.ts`:

```ts
type LoaderArgs = { src: string; width: number; quality?: number }

const CLOUDINARY_UPLOAD = '/image/upload/'

export default function imageLoader({ src, width }: LoaderArgs): string {
  if (src.startsWith('https://res.cloudinary.com/') && src.includes(CLOUDINARY_UPLOAD)) {
    return src.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}f_auto,q_auto,c_limit,w_${width}/`)
  }
  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}w=${width}`
}
```

In `next.config.ts`: `images: { loader: 'custom', loaderFile: './src/utilities/imageLoader.ts' }`.

For R2, add a branch that uses Cloudflare Image Transformations on the bucket's custom domain (`https://<domain>/cdn-cgi/image/width=<w>,quality=80,format=auto/<path>`), which has a free monthly allowance, or omit the custom loader and accept Vercel's image optimization quota. Record the choice in `PROJECT.md`.

Rules:

1. The largest above-the-fold image gets `preload` (Next.js 16 deprecated `priority` in its favor). Every other image lazy-loads (the default).
2. Always pass `sizes`, for example `sizes="(min-width: 1024px) 50vw, 100vw"`.
3. Use the `alt` field from the media document. Decorative images get `alt=""`.

## Step 6: Video

Follow [references/video.md](references/video.md) for Mux, Vimeo, and YouTube. Summary:

- Mux: the plugin creates a `mux-video` collection and uploads directly from the admin browser to Mux. Configure the webhook at `/api/mux/webhook`.
- Vimeo or YouTube: store the URL in a field and render a lightweight facade that loads the player only on click.
- Never autoplay video with sound. Videos below the fold load on interaction or when visible.

## Environment variables

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=site-media
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SIGNING_SECRET=
```

R2 variables are listed in the R2 reference.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| `413` or "Request Entity Too Large" on upload | File passed through a function | Enable `clientUploads` (Step 2) |
| Upload works locally, fails on Vercel with `EROFS` | Local disk storage | Configure a storage plugin |
| R2 direct upload fails with a CORS error | Bucket CORS missing `PUT` or headers | R2 reference, CORS section |
| Images are huge on mobile | No `sizes`, or loader not configured | Step 5 |
| Mux video stuck on "preparing" | Webhook not configured or wrong secret | Video reference |

## Done when

- [ ] Storage plugin configured with `clientUploads: true`
- [ ] Uploading a 10 MB photo in the admin succeeds on the deployed site, and the stored file is WebP and smaller than the original
- [ ] The media document reloads with its URL after a page refresh
- [ ] Frontend images use `next/image` with `sizes` and the configured loader
- [ ] Video plays through the chosen provider without loading the player before interaction
