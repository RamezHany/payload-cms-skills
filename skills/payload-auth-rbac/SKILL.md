---
name: payload-auth-rbac
description: Multiple admins and role-based access control for Payload CMS 3 - users collection with typed roles saved to the JWT, first user becomes admin, collection and field access helpers, privilege escalation protection, login hardening, CSRF and CORS settings, and an access matrix for content, CRM, bookings, and settings. Use when adding admin users, roles, permissions, restricting who can edit or see data, or when saves fail with "You are not allowed to perform this action".
license: MIT
metadata:
  version: "1.0.0"
---

# Payload auth and RBAC

## Step 1: Define roles

Default roles. Adjust in `PROJECT.md` before coding.

| Role | Can do |
| --- | --- |
| `admin` | Everything, including users, settings, and technical collections |
| `editor` | Pages, posts, legal pages, media, header, footer, SEO settings |
| `sales` | Leads and bookings: read and update status and notes; read services |

Access matrix:

| Collection or global | admin | editor | sales | public |
| --- | --- | --- | --- | --- |
| `users` | CRUD | read and update self | read and update self | none |
| `pages`, `posts`, `legal-pages`, `categories` | CRUD | CRUD | read | read published |
| `media` | CRUD | CRUD | read | read |
| `services` | CRUD | CRUD | read | read published |
| `leads` | CRUD | none | read, update | create (through server action only) |
| `bookings` | CRUD | none | read, update | none (server code creates them) |
| `payment-events` | read | none | none | none |
| `header`, `footer`, `site-settings`, `consent-settings` | update | update | read | read |
| `booking-settings` | update | none | read | read (through server code) |

## Step 2: Access helpers

`src/access/hasRole.ts`:

```ts
import type { Access, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

export type Role = User['role']

export const hasRole =
  (...roles: Role[]): Access =>
  ({ req: { user } }) =>
    Boolean(user && roles.includes(user.role))

export const hasRoleField =
  (...roles: Role[]): FieldAccess =>
  ({ req: { user } }) =>
    Boolean(user && roles.includes(user.role))

export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}
```

Keep the template's `authenticated`, `authenticatedOrPublished`, and `anyone` helpers. Use `hasRole` for everything role-specific.

## Step 3: Users collection

`src/collections/Users/index.ts`:

```ts
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { adminOrSelf, hasRole, hasRoleField } from '@/access/hasRole'
import type { User } from '@/payload-types'

const firstUserIsAdmin: CollectionBeforeChangeHook<User> = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { totalDocs } = await req.payload.count({ collection: 'users', req })
  return totalDocs === 0 ? { ...data, role: 'admin' } : data
}

export const Users: CollectionConfig<'users'> = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role', 'updatedAt'],
  },
  access: {
    admin: ({ req: { user } }) => Boolean(user),
    create: hasRole('admin'),
    read: adminOrSelf,
    update: adminOrSelf,
    delete: hasRole('admin'),
  },
  hooks: {
    beforeChange: [firstUserIsAdmin],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Sales', value: 'sales' },
      ],
      access: {
        create: hasRoleField('admin'),
        update: hasRoleField('admin'),
      },
    },
  ],
}
```

- `saveToJWT: true` puts the role in the token, so access checks do not query the database.
- Field-level access on `role` prevents editors from promoting themselves.
- The first-user registration screen bypasses collection access, and the hook makes that user an admin.
- Run `pnpm generate:types` so `User['role']` becomes a typed union.

## Step 4: Apply access to every collection

1. Every collection and global declares all of `create`, `read`, `update`, `delete` explicitly. Never rely on defaults.
2. Public forms never get `create: anyone` on a collection when a server action can create the document with the Local API. Keep `create` restricted and let the server action write after validation.
3. Hide technical collections from the sidebar for non-admins: `admin: { hidden: ({ user }) => user?.role !== 'admin' }`.
4. In server code that runs for a visitor or a logged-in user, pass `overrideAccess: false` and `user` to the Local API.

## Step 5: Request security

In `src/payload.config.ts`:

```ts
serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
csrf: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
```

`csrf` must list every origin that sends authenticated cookie requests. A missing production origin makes admin saves fail with 403 after deploy while working locally.

## Step 6: Inviting admins

1. An admin creates the user with a temporary password and the right role.
2. With an email adapter configured (`payload-integrations`), the new user can use "Forgot password" to set their own password.
3. Never share one login between people; each admin gets a user so changes are traceable.

## Diagnosis

| Symptom | Cause | Fix |
| --- | --- | --- |
| "You are not allowed to perform this action" on save | Collection `update` access denies the role | Check the matrix and the helper used |
| Field silently not saved | Field-level `update` access returns false | Check field `access` |
| Saves work locally, 403 in production | Production origin missing from `csrf` or wrong `serverURL` | Step 5 |
| Editor can see other users' emails | `read` on `users` not restricted | Use `adminOrSelf` |

## Done when

- [ ] Roles and matrix recorded in `PROJECT.md`
- [ ] First registered user is `admin`; later users default to `editor`
- [ ] An editor cannot change their own role (verified by trying it in the admin)
- [ ] Every collection and global declares all access functions
- [ ] `csrf`, `cors`, and `serverURL` include the production origin
