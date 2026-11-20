# MCP setup

Plugin source checked at `@payloadcms/plugin-mcp` 3.94.0. Docs: https://payloadcms.com/docs/plugins/mcp

## Plugin config

`src/plugins/index.ts` (the `disabled` flag and the collection map are in `SKILL.md`). Add the keys-collection override:

```ts
import type { PayloadRequest } from 'payload'

import { hasRole } from '@/access/hasRole'
import { mcpDraftOnly } from '@/hooks/mcpDraftOnly'

const adminOnly = hasRole('admin')

overrideApiKeyCollection: (collection) => {
  collection.admin = { ...collection.admin, group: 'Settings', hidden: false }
  collection.access = {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    unlock: adminOnly,
  }
  return collection
},
```

`hasRole('admin')` matches the users collection from the `payload-auth-rbac` skill. The key's `user` is the admin who created it. Requests run as that user with `overrideAccess: false`.

Descriptions on each collection help the model pick a tool. One sentence, factual, for example `posts`: "Published and draft articles. Creating or updating through MCP always saves a draft."

## Draft and delete hook

`src/hooks/mcpDraftOnly.ts`

```ts
import 'server-only'

import { APIError, type CollectionBeforeOperationHook } from 'payload'

function asDraft<T>(data: T): T {
  if (!data || typeof data !== 'object') return data
  return { ...data, _status: 'draft' as const }
}

export const mcpDraftOnly: CollectionBeforeOperationHook = (hookArgs) => {
  if (hookArgs.req.payloadAPI !== 'MCP') return hookArgs.args

  if (hookArgs.operation === 'delete' || hookArgs.operation === 'deleteByID') {
    throw new APIError('MCP cannot delete documents', 403)
  }

  if (hookArgs.operation === 'create') {
    return { ...hookArgs.args, draft: true, data: asDraft(hookArgs.args.data) }
  }

  if (hookArgs.operation === 'update') {
    return { ...hookArgs.args, draft: true, data: asDraft(hookArgs.args.data) }
  }

  if (hookArgs.operation === 'updateByID') {
    return { ...hookArgs.args, draft: true, data: asDraft(hookArgs.args.data) }
  }

  return hookArgs.args
}
```

If TypeScript rejects the spread inside `asDraft`, inline `{ ...hookArgs.args.data, _status: 'draft' as const }` in each write branch. That error also means the collection has no `versions.drafts`, so do not attach the hook. Do not cast the arguments.

Attach it beside the existing hooks:

```ts
hooks: {
  beforeOperation: [mcpDraftOnly],
  afterChange: [revalidateOnPublish<Page>('pages', pageTargets)],
},
```

In Payload 3.94.0 the create tool passes the model's `draft` argument through to `payload.create` and defaults it to `false`. The update tool does the same with `payload.update`. An `id` makes the Local API call `updateByIDOperation` or `deleteByIDOperation` (`collections/operations/local/update.ts` and `delete.ts`). `beforeOperation` still receives `update` and `delete`, because `operationToHookOperation` maps `updateByID` to `update` and `deleteByID` to `delete` (`collections/operations/utilities/types.ts`). The type also allows the unmapped names, and a comment in `buildBeforeOperation.ts` says v4 should stop mapping them. This hook handles `update`, `updateByID`, `delete`, and `deleteByID`. Forcing `_status` to `'draft'` stops a model from sending `_status: 'published'` in the body.

Only collections with `versions.drafts` get this hook. A draft write does not revalidate. Confirm the public page is unchanged and the admin shows a draft.

The delete tool is registered only when that collection's `enabled.delete` is true and the key allows it. With both left off, `tools/call` for a delete name fails because the tool is not registered. The hook is the second lock if a later edit turns delete on.

## Custom tool

Add a tool only when `PROJECT.md` asks. The `parameters` value is the `.shape` of a Zod object, matching the plugin docs.

```ts
import { z } from 'zod'

{
  name: 'countDraftPosts',
  description: 'Count draft posts. Does not publish or delete.',
  parameters: z.object({}).shape,
  handler: async (_args, req) => {
    const { totalDocs } = await req.payload.count({
      collection: 'posts',
      where: { _status: { equals: 'draft' } },
      req,
      overrideAccess: false,
      user: req.user,
    })
    return { content: [{ type: 'text', text: String(totalDocs) }] }
  },
}
```

The handler's second argument is the Payload request. The plugin passes it. Enable the new tool on the API key or it will not be listed.

Prompts use `mcp.prompts` (`name`, `title`, `description`, `argsSchema`, `handler`). Resources use `mcp.resources`. Skip both unless a brief names them.

Do not enable `experimental.tools`. In 3.94.0 those tools are registered only when `NODE_ENV` is `development`, and they write collection files to disk.
