# Code conventions

## TypeScript

- `strict: true`. No `any`, no `@ts-ignore`, no non-null assertions on data from the CMS.
- Import generated types from `@/payload-types` (`Post`, `Page`, `Media`). Regenerate with `pnpm generate:types` after schema changes.
- Payload relationship fields are `number | Doc` (SQLite IDs are numbers) depending on `depth`. Narrow with `typeof value === 'object'` before reading properties.
- Exhaustive switches:

```ts
type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled'

function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'Awaiting payment'
    case 'confirmed':
      return 'Confirmed'
    case 'cancelled':
      return 'Cancelled'
    default: {
      const unhandled: never = status
      throw new Error(`Unhandled status: ${String(unhandled)}`)
    }
  }
}
```

## Payload access from server code

`src/lib/payload.ts`:

```ts
import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const getPayloadClient = () => getPayload({ config: configPromise })
```

- Pass `overrideAccess: false` and `user` when a query runs on behalf of a visitor or a logged-in user. The Local API skips access control by default.
- Pass `req` to nested operations inside hooks so they share the transaction.
- Use `select` and `depth` to fetch only what the page renders.

## Client data with TanStack Query

`src/providers/QueryProvider.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

Mount it in the frontend layout only, never in the Payload admin.

Query keys live in the feature folder:

```ts
export const bookingKeys = {
  all: ['booking'] as const,
  slots: (date: string) => [...bookingKeys.all, 'slots', date] as const,
}
```

## Forms with React Hook Form + Zod

One schema per form in the feature folder, shared by client and server.

`src/features/leads/schema.ts`:

```ts
import { z } from 'zod'

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.e164().optional(),
  message: z.string().trim().min(10).max(5000),
})

export type LeadInput = z.infer<typeof leadSchema>
```

`src/features/leads/actions.ts`:

```ts
'use server'

import { getPayloadClient } from '@/lib/payload'

import { leadSchema, type LeadInput } from './schema'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function submitLead(input: LeadInput): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input' }

  const payload = await getPayloadClient()
  await payload.create({ collection: 'leads', data: { ...parsed.data, source: 'contact-form' } })
  return { ok: true }
}
```

`src/features/leads/components/LeadForm.tsx`:

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { submitLead } from '../actions'
import { leadSchema, type LeadInput } from '../schema'

export function LeadForm() {
  const form = useForm<LeadInput>({ resolver: zodResolver(leadSchema) })
  const mutation = useMutation({ mutationFn: submitLead })

  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      {/* fields bound with form.register('name') etc. */}
    </form>
  )
}
```

Rules:

- Never write regex for email, URL, phone, or UUID. Use `z.email()`, `z.url()`, `z.e164()`, `z.uuid()`.
- Server actions always re-validate with the same schema.
- Server action request bodies are limited to 1 MB by default. Files never go through server actions; see the `payload-media` skill.

## Components

- Server Components by default; `'use client'` only where needed, at the smallest boundary.
- Heavy client-only widgets (3D, maps, animation timelines) load with `next/dynamic` and `ssr: false` inside a client component.
- Images use `next/image` with explicit `width`/`height` or `fill` + `sizes`.
- Text never hardcoded in localized sites; use the translation messages or CMS fields.

## Imports

- Order: Node built-ins, external packages, `@/` aliases, relative imports.
- No barrel `index.ts` files that re-export a folder.
- No inline `import()` except through `next/dynamic`.

## Styling

- Tailwind CSS utility classes. Design tokens (colors, fonts, radius) defined once in `src/app/(frontend)/globals.css` with `@theme`.
- No inline `style` objects except for dynamic values.
- shadcn/ui is never the base design system. Fetch an individual registry component only when `PROJECT.md` approves it.
