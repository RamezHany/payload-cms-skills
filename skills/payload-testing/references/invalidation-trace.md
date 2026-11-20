# Invalidation trace

This spec is the delivery gate for cache cost. It fails when a save revalidates anything other than its row in `PROJECT.md`. The rules live in the `payload-performance` skill. This file only tells you how to prove them.

## Map cells the spec can read

Keep the `## Invalidation map` section. Above the table, one line:

```text
Locales: en, ar
```

Use the project's locale codes. One collection or global per row. Split combined rows.

| Column | Allowed values |
| --- | --- |
| Collection or global | The slug, exactly |
| Trigger | `publish`, `create`, `update`, or `any` |
| Paths | `none`, `layout`, or a comma-separated list of templates |
| Tags | `none`, or a comma-separated list of templates |
| Writes per save | The estimate from the `payload-performance` skill. The spec does not read it |

Templates:

- `<locale>` expands to each code on the Locales line. A site with no locales has `Locales: -` and templates omit `<locale>`.
- `<slug>` expands to the fixture slug below.

Path examples: `/<locale>/posts/<slug>`, `/<locale>/posts`. Tag examples: `posts:<slug>`, `collection:posts`, `posts-sitemap`.

`layout` is legal only for a global that renders in the root layout (header, footer, site settings, consent settings). The preferred hook for that row calls `revalidateTag('global_<slug>', { expire: 0 })` and does not call `revalidatePath`. Zero path calls pass. `revalidatePath(path, 'layout')` also passes for that row only. Any other row that says `layout`, `all routes`, or a parenthetical range fails the spec. Rewrite the cell until it lists real paths.

Forbidden tags, in any row: `cms-content`, `all`, `site`.

A media update that emits the tags of the post it references is correct. Those tags also appear on the posts row. What fails the spec is a tag emitted by every ordinary row (the old `cms-content` pattern) or a tag in the forbidden set. Layout rows may use `global_<slug>`.

## Fixtures

Use these slugs so the expanded templates are stable:

| Slug | Fixture |
| --- | --- |
| `posts` | slug `trace-post` |
| `pages` | slug `trace-page` |
| `legal-pages` | slug `trace-legal` |
| `services` | slug `trace-service` |
| anything else with a slug | slug `trace-doc` |

Create the document with the field values that make the targets function return exactly the paths in the row. If the home page is in the row, the fixture must be featured. If it is not featured, do not put the home path in the row.

## The spec

`tests/int/invalidation.int.spec.ts`

```ts
import { readFileSync } from 'node:fs'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { applyRevalidation, mergeTargets, type RevalidationTargets } from '@/utilities/revalidation'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T>(fn: () => T) => fn,
}))

const FORBIDDEN_TAGS = new Set(['cms-content', 'all', 'site'])

type MapRow = {
  slug: string
  trigger: 'publish' | 'create' | 'update' | 'any'
  paths: string
  tags: string
}

type Trigger = MapRow['trigger']

function parseMap(markdown: string): { locales: string[]; rows: MapRow[] } {
  const section = markdown.split(/^## Invalidation map\s*$/m)[1]
  if (!section) throw new Error('PROJECT.md is missing ## Invalidation map')
  const localesMatch = section.match(/^Locales:\s*(.+)$/m)
  if (!localesMatch) throw new Error('Invalidation map is missing a Locales line')
  const locales = localesMatch[1].trim() === '-' ? [] : localesMatch[1].split(',').map((item) => item.trim())
  const tableLines = section.split('\n').filter((line) => line.trim().startsWith('|'))
  const rows = tableLines.slice(2).map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
    const trigger = cells[1] as Trigger
    if (trigger !== 'publish' && trigger !== 'create' && trigger !== 'update' && trigger !== 'any') {
      throw new Error(`Row "${cells[0]}" has trigger "${cells[1]}". Use publish, create, update, or any.`)
    }
    return { slug: cells[0], trigger, paths: cells[2], tags: cells[3] }
  })
  return { locales, rows }
}

function expand(template: string, locales: string[], slug: string): string[] {
  if (template === 'none' || template === 'layout') return []
  const parts = template.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.flatMap((part) => {
    if (part.includes('<locale>') && locales.length === 0) {
      throw new Error(`Template "${part}" uses <locale> but the map has no locales`)
    }
    const withSlug = part.replaceAll('<slug>', slug)
    if (!withSlug.includes('<locale>')) return [withSlug]
    return locales.map((locale) => withSlug.replaceAll('<locale>', locale))
  })
}

function fixtureSlug(collection: string): string {
  switch (collection) {
    case 'posts':
      return 'trace-post'
    case 'pages':
      return 'trace-page'
    case 'legal-pages':
      return 'trace-legal'
    case 'services':
      return 'trace-service'
    default:
      return 'trace-doc'
  }
}

function recordedPaths(): string[] {
  return vi.mocked(revalidatePath).mock.calls.map((call) => call[0])
}

function recordedTags(): string[] {
  return vi.mocked(revalidateTag).mock.calls.map((call) => call[0])
}

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.destroy()
})

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear()
  vi.mocked(revalidateTag).mockClear()
})

describe('invalidation trace', () => {
  const { locales, rows } = parseMap(readFileSync('PROJECT.md', 'utf8'))

  it('covers every map row', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  for (const row of rows) {
    it(`${row.slug} ${row.trigger} matches its map row`, async () => {
      await runCase(payload, row)
      const paths = recordedPaths()
      const tags = recordedTags()
      const layoutCalls = vi.mocked(revalidatePath).mock.calls.filter((call) => call[1] === 'layout')

      if (row.paths === 'layout') {
        expect(layoutCalls).toHaveLength(vi.mocked(revalidatePath).mock.calls.length)
      } else {
        expect(layoutCalls, `${row.slug} used layout revalidation`).toHaveLength(0)
        expect(paths.sort()).toEqual(expand(row.paths, locales, fixtureSlug(row.slug)).sort())
      }

      expect(tags.sort()).toEqual(expand(row.tags, locales, fixtureSlug(row.slug)).sort())

      for (const tag of tags) {
        expect(FORBIDDEN_TAGS.has(tag), tag).toBe(false)
      }
      for (const call of vi.mocked(revalidateTag).mock.calls) {
        expect(call[1]).toEqual({ expire: 0 })
      }
    })
  }

  it('rejects a tag that every ordinary row emits', () => {
    const ordinary = rows.filter((row) => row.paths !== 'layout' && row.tags !== 'none')
    if (ordinary.length < 2) return
    const sets = ordinary.map((row) => new Set(expand(row.tags, locales, fixtureSlug(row.slug))))
    const [first, ...rest] = sets
    if (!first) return
    for (const tag of first) {
      const shared = rest.every((set) => set.has(tag))
      expect(shared, `${tag} is on every ordinary row`).toBe(false)
    }
  })

  it('revalidates a batch once', () => {
    const first: RevalidationTargets = {
      reason: 'batch',
      paths: ['/en/posts/trace-post', '/en/posts'],
      tags: ['posts:trace-post', 'collection:posts'],
    }
    const second: RevalidationTargets = {
      reason: 'batch',
      paths: ['/en/posts/trace-post', '/ar/posts'],
      tags: ['collection:posts', 'posts-sitemap'],
    }
    applyRevalidation(mergeTargets(first, second), payload)
    expect(recordedPaths().sort()).toEqual(['/ar/posts', '/en/posts', '/en/posts/trace-post'])
    expect(recordedTags().sort()).toEqual(['collection:posts', 'posts-sitemap', 'posts:trace-post'])
  })
})

const HANDLED = ['posts', 'media'] as const
type TraceSlug = (typeof HANDLED)[number]

function isTraceSlug(slug: string): slug is TraceSlug {
  return (HANDLED as readonly string[]).includes(slug)
}

async function runCase(payload: Payload, row: MapRow): Promise<void> {
  if (!isTraceSlug(row.slug)) {
    throw new Error(`No invalidation case for ${row.slug}. Add it to HANDLED and to the switch.`)
  }
  switch (row.slug) {
    case 'posts':
      await savePost(payload, row.trigger)
      return
    case 'media':
      await saveMedia(payload, row.trigger)
      return
    default: {
      const unhandled: never = row.slug
      throw new Error(`No invalidation case for ${String(unhandled)}`)
    }
  }
}

async function savePost(_payload: Payload, _trigger: Trigger): Promise<void> {
  throw new Error('Implement savePost with this project\'s required fields')
}

async function saveMedia(_payload: Payload, _trigger: Trigger): Promise<void> {
  throw new Error('Implement saveMedia with this project\'s media fields')
}
```

`payload.destroy()` closes the SQLite handle. If the installed Payload type has no `destroy`, delete that `afterAll`. Do not invent another close method.

Add every map slug to `HANDLED` and a matching `case`. The `never` default then fails the typecheck when a slug is added to `HANDLED` without a case. A slug that is only in the map throws when the spec runs. Replace `savePost` and `saveMedia`, and add one function per extra slug. Each function must:

1. Honor `row.trigger`. `publish` creates or updates a document with `_status: 'published'`. `create` on media uploads a new file. `update` changes an existing document. `any` performs one write.
2. Pass `draft: true` only for the draft assertion below, not for a publish row.
3. Use `fixtureSlug(row.slug)` as the slug.
4. Not pass `disableRevalidate`.

Add two more tests outside the row loop, using the same spies:

1. Create a post with `draft: true` and `_status: 'draft'`. Assert `recordedPaths()` and `recordedTags()` are empty.
2. Create a media document (do not update an existing one). Assert both lists are empty. A 1 pixel PNG buffer is enough for the Local API create; the admin optimizer is not involved here.

```ts
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

await payload.create({
  collection: 'media',
  data: { alt: 'trace' },
  file: { data: png, mimetype: 'image/png', name: 'tiny.png', size: png.length },
})
```

Pass `alt` the way the media collection requires (localized or not).

## Batch context

Also assert the hook flag used by imports and seeds. Create two published documents with `context: { disableRevalidate: true }` and assert both spy lists are still empty. The batch test above then checks that one `applyRevalidation` of the merged targets emits each path once. That is the pattern in the `payload-performance` skill.

## When the spec fails

An extra path is a product bug even if the page looks right. Fix the targets function or the map, whichever one is wrong. Do not delete the assertion. Do not add the extra path to the map to make the spec pass unless that path really renders the document.
