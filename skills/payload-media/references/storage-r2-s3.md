# Cloudflare R2 or S3 with direct uploads

Use `@payloadcms/storage-s3` for both. R2 speaks the S3 API.

## 1. Create the bucket

R2:

1. Create a bucket in the Cloudflare dashboard.
2. Connect a custom domain (for example `media.example.com`) under the bucket's public access settings. Do not use the `r2.dev` development URL in production; it is rate limited.
3. Create an R2 API token with Object Read & Write access to this bucket only.

## 2. Bucket CORS

Direct uploads send a `PUT` from the admin's browser. Add this CORS policy (R2: bucket settings, CORS policy; S3: bucket permissions, CORS):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://example.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
    "MaxAgeSeconds": 3600
  }
]
```

Add every origin where the admin runs (production domain and any preview domain the client uses).

## 3. Plugin config

Install `@payloadcms/storage-s3` at the Payload version. In `src/plugins/index.ts`:

```ts
import { s3Storage } from '@payloadcms/storage-s3'

s3Storage({
  collections: {
    media: {
      prefix: 'media',
      disablePayloadAccessControl: true,
      generateFileURL: ({ filename, prefix }) =>
        [process.env.R2_PUBLIC_URL, prefix, filename].filter(Boolean).join('/'),
    },
  },
  bucket: process.env.R2_BUCKET || '',
  config: {
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  },
  clientUploads: true,
}),
```

- `disablePayloadAccessControl: true` serves files straight from the public domain instead of proxying them through `/api/media/file/...`, which would consume function time and bandwidth.
- Only use it for public media. For private files (invoices, client documents), keep Payload access control on and use a separate collection without this flag.
- For AWS S3, drop `endpoint` and `forcePathStyle`, set the bucket's region, and point `generateFileURL` at the CloudFront or bucket URL.

## 4. Environment variables

```bash
R2_ACCOUNT_ID=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=https://media.example.com
```

## 5. next.config.ts

Allow the public domain for `next/image`:

```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'media.example.com' }],
},
```

## 6. Verify

1. Upload an image larger than 5 MB in the admin on a deployed environment.
2. In the browser network tab, the file request goes to `*.r2.cloudflarestorage.com` (or S3), not to `/api/media`.
3. The saved document's `url` starts with `R2_PUBLIC_URL`.
4. Opening the URL in a private window shows the image.
