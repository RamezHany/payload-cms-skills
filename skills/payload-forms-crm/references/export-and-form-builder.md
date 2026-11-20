# Export and the form builder

## Spreadsheet escaping

`src/utilities/escapeSpreadsheet.ts`

```ts
const LEADING = ['=', '+', '-', '@', '\t', '\r']

export function escapeSpreadsheetCell(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value
  return LEADING.includes(value[0] ?? '') ? `'${value}` : value
}

export function escapeRow(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) next[key] = escapeSpreadsheetCell(value)
  return next
}
```

Use `escapeRow` as the import-export `before` hook shown in `SKILL.md`. Use `escapeSpreadsheetCell` for any CSV this project writes itself, including a manual download route. The Sheets append in the `payload-integrations` skill uses the same prefix and `valueInputOption: 'RAW'`.

`ipHash` stays out of the file because the field sets `custom['plugin-import-export'].disabled` to true. Disabled fields are omitted from the export and ignored on import.

Who can export: `admin` and `sales`, because they can already read every lead. Editors cannot. The exports collection access is the gate. Payload warns that read access on the uploads collection can bypass the source collection's access control, which is why `disableSave: true` does not keep a file, and why read is not `anyone`.

## Form builder plugin

Use this only after Step 1 of `SKILL.md` says editors build forms. Install `@payloadcms/plugin-form-builder` at the same version as `payload`.

```ts
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'

import { hasRole } from '@/access/hasRole'

formBuilderPlugin({
  fields: {
    text: true,
    textarea: true,
    email: true,
    select: true,
    radio: true,
    checkbox: true,
    number: true,
    message: true,
    date: false,
    payment: false,
    upload: false,
    state: false,
    country: false,
  },
  redirectRelationships: ['pages'],
  formOverrides: {
    access: {
      read: () => true,
      create: hasRole('admin', 'editor'),
      update: hasRole('admin', 'editor'),
      delete: hasRole('admin'),
    },
  },
  formSubmissionOverrides: {
    access: {
      create: () => false,
      read: hasRole('admin', 'sales'),
      update: () => false,
      delete: hasRole('admin'),
    },
  },
}),
```

`payment` stays off. Payments belong to the `payload-bookings-payments` skill. `upload` stays off because a serverless function rejects bodies over 4.5 MB (the `payload-media` skill). The plugin's default `create` on `form-submissions` is public. The override closes it. The page posts through a server action that repeats the honeypot, Turnstile, and rate-limit checks, then `payload.create` with `overrideAccess: true`.

The plugin's own email uses the adapter from the `payload-integrations` skill. `defaultToEmail` is the fallback recipient. Dynamic tokens in the admin email body are `{{field_name}}`, `{{*}}`, and `{{*:table}}`.

Do not rename `form-submissions` to `leads`. Keep the CRM collection from this skill. If a builder form should also enter the CRM, an `afterChange` hook on `form-submissions` creates one `leads` document. That create revalidates nothing.

### Dynamic fields

Load the form with the Local API (`depth` enough to read `fields`). Build a Zod object from the blocks the plugin actually stores. Enabled `blockType` values are `text`, `textarea`, `email`, `select`, `radio`, `checkbox`, `number`, `message`, and `date`.

```ts
import { z } from 'zod'

type BuilderBlock =
  | { blockType: 'text' | 'textarea'; name: string; required?: boolean | null }
  | { blockType: 'email'; name: string; required?: boolean | null }
  | { blockType: 'select' | 'radio'; name: string; required?: boolean | null; options?: { value: string }[] | null }
  | { blockType: 'checkbox'; name: string; required?: boolean | null }
  | { blockType: 'number'; name: string; required?: boolean | null }
  | { blockType: 'date'; name: string; required?: boolean | null }
  | { blockType: 'message' }

function fieldSchema(field: BuilderBlock): z.ZodType | null {
  switch (field.blockType) {
    case 'message':
      return null
    case 'email':
      return field.required ? z.email() : z.email().optional()
    case 'number':
      return field.required ? z.number() : z.number().optional()
    case 'checkbox':
      return field.required ? z.literal(true) : z.boolean().optional()
    case 'select':
    case 'radio': {
      const values = (field.options ?? []).map((option) => option.value).filter(Boolean)
      if (values.length === 0) return z.string().max(200).optional()
      const asTuple = [values[0], ...values.slice(1)] as [string, ...string[]]
      const schema = z.enum(asTuple)
      return field.required ? schema : schema.optional()
    }
    case 'date':
      return field.required ? z.iso.datetime() : z.iso.datetime().optional()
    case 'text':
    case 'textarea':
      return field.required ? z.string().trim().min(1).max(5000) : z.string().trim().max(5000).optional()
    default: {
      const unhandled: never = field
      throw new Error(`Unhandled form block: ${String(unhandled)}`)
    }
  }
}
```

`z.iso.datetime()` is the Zod 4 name. If the installed `zod` types do not export it, check `zod` 4.6 for the ISO datetime helper and use that. Do not replace it with a regex.

`message` blocks are display-only. Skip them in the schema and render the rich text as text, not as an input.

Render each remaining block with `register(field.name)` inside React Hook Form. The server action `safeParse`s the same dynamic schema, then writes:

```ts
await payload.create({
  collection: 'form-submissions',
  overrideAccess: true,
  data: {
    form: formId,
    submissionData: Object.entries(parsed.data).map(([field, value]) => ({ field, value: String(value) })),
  },
})
```

Check the generated `FormSubmission` type after `pnpm generate:types` and match `submissionData` to it. Do not invent extra keys. Checkbox values are `'true'` or `'false'` strings because the plugin stores submission values as strings in the default shape. If the generated field is a structured JSON value instead of a string, store the parsed value and do not force `String()`.

This path does not add a revalidation hook. `form-submissions` get the same invalidation-map row as `leads`: no paths, no tags, zero writes.
