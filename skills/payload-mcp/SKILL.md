---
name: payload-mcp
description: Optional Payload CMS 3 MCP plugin for editor AI clients. Least-privilege API keys, drafts-only writes, no access to users, leads, bookings, or payments, an env switch that removes the endpoint, and client setup for Cursor, Claude, and VS Code. Use when connecting an AI client to the CMS, or when deciding whether AI write access should be enabled.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload MCP

Adds `POST /api/mcp` so an editor's AI client can read and draft content. It is off unless the client agrees, in writing, that an AI may create and edit drafts.

## When to enable it

Enable it when an editor will draft pages or posts from Cursor, Claude Code, or VS Code, and a human publishes in the admin.

Do not enable it when:

- The site has no one who will review drafts before they go live.
- The client has not approved AI write access.
- The only goal is a public chatbot. This endpoint is an admin tool.

## Stop and ask

Stop before installing the plugin. Ask the client to approve AI write access, which collections drafts may touch, and who may hold a key. Record the answers in `PROJECT.md`. If they say no, set `PAYLOAD_MCP_ENABLED` unset and skip the rest.

## Step 1: Install and gate the plugin

`pnpm add @payloadcms/plugin-mcp@<same version as payload>`.

In `src/plugins/index.ts`:

```ts
import { mcpPlugin } from '@payloadcms/plugin-mcp'

mcpPlugin({
  disabled: process.env.PAYLOAD_MCP_ENABLED !== 'true',
  collections: {
    pages: { enabled: { find: true, create: true, update: true, delete: false } },
    posts: { enabled: { find: true, create: true, update: true, delete: false } },
    'legal-pages': { enabled: { find: true, create: true, update: true, delete: false } },
  },
  globals: {
    header: { enabled: { find: true, update: false } },
    footer: { enabled: { find: true, update: false } },
    'site-settings': { enabled: { find: true, update: false } },
  },
  // overrideApiKeyCollection: see the setup reference
}),
```

`disabled` is a real option. In `@payloadcms/plugin-mcp` 3.94.0 the API keys collection is still registered, and the `/api/mcp` routes are not. Toggling the env var does not change the database schema. Do not conditionally omit the plugin; that drops the collection and breaks migrations.

`enabled` on a collection is the ceiling. Each API key then turns operations off again. Omit `delete` or set it false. The plugin's create and update tools default `draft` to false, so a model that forgets the flag would publish. Step 2 closes that.

Never put `users`, `leads`, `bookings`, `payment-events`, `form-submissions`, or `payload-mcp-api-keys` in `collections` or `globals`. Media has no drafts; leave it out unless `PROJECT.md` accepts immediate file creates. Do not set `experimental`. Those tools can write source files, and the plugin already refuses them outside development.

Full plugin object, including admin access to the keys collection: [references/setup.md](references/setup.md).

## Step 2: Drafts only, and no deletes

On every collection in Step 1 that has `versions.drafts`, add the `beforeOperation` hook from the setup reference.

When `req.payloadAPI === 'MCP'`:

- `create` and `update` run with `draft: true` and `_status: 'draft'`.
- `delete` throws a 403 even if a later config enables the tool.

The plugin sets `req.payloadAPI` to `'MCP'`. Writes still pass through collection hooks, with `overrideAccess: false` and the key's user. A draft does not revalidate (the `payload-performance` skill). Publishing stays a human action in the admin.

Do not attach this hook to a collection that has no drafts. `draft: true` there is an error.

## Step 3: Keys

The generated collection slug is `payload-mcp-api-keys`. The plugin hides it from the admin until `overrideApiKeyCollection` sets access. Restrict that access with `hasRole('admin')` from the `payload-auth-rbac` skill.

1. An admin creates one key per client (one for Cursor, another for Claude). Do not share a key between people.
2. On that key, allow find, create, and update only for the collections in Step 1. Leave delete off. Leave every custom tool off.
3. The key acts as its owner. Owners are admins, so collection access still allows the write, and Step 2 keeps it a draft.
4. Copy the key into the AI client's local config. It does not go in the website repo, `.env` of the site, or a screenshot.

Requests without `Authorization: Bearer <key>` are rejected. Production `serverURL` is `https` (the `payload-auth-rbac` skill). Clients must use that `https` origin. An `http://` production URL would send the bearer token in clear text. `http://127.0.0.1:3000` is fine for local development.

## Step 4: Time limit

`mcp.handlerOptions.maxDuration` defaults to 60 seconds inside the MCP handler. That is the right value. Vercel Hobby functions top out at 300 seconds with fluid compute (verify at https://vercel.com/docs/functions/configuring-functions/duration). Do not raise the handler above the plan maximum.

The Next.js limit is the Payload catch-all route, not a route the plugin creates. If that route sets `export const maxDuration`, keep it at 60 so a stuck MCP call cannot occupy a function for the full Hobby window. `maxDuration` is a number of seconds on the route module.

Leave `mcp.handlerOptions.verboseLogs` unset. When true, the plugin logs the document JSON.

## Step 5: Clients

Client snippets from the plugin docs, and the rule for checking them again, are in [references/clients.md](references/clients.md). The endpoint is `POST /api/mcp`. `GET` returns "Method not allowed" even with a valid key.

Tool names come from `tools/list`. For a slug `posts` the read tool is `findPosts`. Do not guess names for slugs that contain a hyphen; read the list.

Custom tools, prompts, and resources exist on `mcp.tools`, `mcp.prompts`, and `mcp.resources`. Add one only when `PROJECT.md` names the task. A tool handler receives `(args, req)`. Pass `req`, and pass `overrideAccess: false` plus `user: req.user` on every Local API call. Do not add a tool that deletes, sends mail, or reads leads.

## Environment variables

```bash
PAYLOAD_MCP_ENABLED=
```

`true` registers the endpoint. Any other value, including empty, leaves the keys collection in place and does not register `/api/mcp`. Restart `pnpm dev` or redeploy after changing it.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| 404 on `/api/mcp` | `PAYLOAD_MCP_ENABLED` is not `true`, or the server was not restarted | Step 1 |
| Tools list is empty | The key allows nothing, or `enabled` omitted the collection | Steps 1 and 3 |
| A create is published | The draft hook is missing, or the collection has no `versions.drafts` | Step 2 |
| Admin cannot open API keys | `overrideApiKeyCollection` was not set | Setup reference |
| Client connects on localhost and fails in production | Production URL is `http`, or the key was created against another database | Step 3 |

## Done when

- [ ] `tools/list` with a restricted key returns find, create, and update for the allowed collections, and no delete tool, no users, and no leads
- [ ] A create through MCP has `_status` `draft` and does not show on the public page
- [ ] A delete call is refused (tool missing, or 403 from the hook)
- [ ] Setting `PAYLOAD_MCP_ENABLED` to empty and restarting makes `POST /api/mcp` 404
- [ ] The key is not in the website repository
