# Leads collection

`src/collections/Leads/index.ts`. Access helpers come from the `payload-auth-rbac` skill.

```ts
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { hasRole, hasRoleField } from '@/access/hasRole'
import type { Lead } from '@/payload-types'

const stampConsent: CollectionBeforeChangeHook<Lead> = ({ data }) => {
  if (data.consent && !data.consentAt) {
    return { ...data, consentAt: new Date().toISOString() }
  }
  return data
}

const salesCanUpdate = hasRoleField('admin', 'sales')
const adminOnlyUpdate = hasRoleField('admin')

export const Leads: CollectionConfig<'leads'> = {
  slug: 'leads',
  defaultSort: '-createdAt',
  admin: {
    group: 'Leads & Bookings',
    useAsTitle: 'name',
    defaultColumns: ['createdAt', 'name', 'email', 'status', 'source', 'assignedTo'],
    listSearchableFields: ['name', 'email', 'phone', 'source'],
  },
  access: {
    create: () => false,
    read: hasRole('admin', 'sales'),
    update: hasRole('admin', 'sales'),
    delete: hasRole('admin'),
  },
  hooks: {
    beforeChange: [stampConsent],
  },
  fields: [
    { name: 'name', type: 'text', required: true, access: { update: adminOnlyUpdate } },
    { name: 'email', type: 'email', required: true, access: { update: adminOnlyUpdate } },
    { name: 'phone', type: 'text', access: { update: adminOnlyUpdate } },
    { name: 'message', type: 'textarea', required: true, access: { update: adminOnlyUpdate } },
    {
      name: 'source',
      type: 'text',
      required: true,
      index: true,
      access: { update: adminOnlyUpdate },
      admin: { description: 'Form id, for example contact.' },
    },
    { name: 'pageUrl', type: 'text', access: { update: adminOnlyUpdate } },
    {
      name: 'locale',
      type: 'select',
      required: true,
      options: ['en', 'ar'],
      access: { update: adminOnlyUpdate },
    },
    { name: 'utmSource', type: 'text', access: { update: adminOnlyUpdate } },
    { name: 'utmMedium', type: 'text', access: { update: adminOnlyUpdate } },
    { name: 'utmCampaign', type: 'text', access: { update: adminOnlyUpdate } },
    { name: 'utmTerm', type: 'text', access: { update: adminOnlyUpdate } },
    { name: 'utmContent', type: 'text', access: { update: adminOnlyUpdate } },
    {
      name: 'consent',
      type: 'checkbox',
      required: true,
      access: { update: adminOnlyUpdate },
    },
    {
      name: 'consentAt',
      type: 'date',
      required: true,
      access: { update: adminOnlyUpdate },
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Won', value: 'won' },
        { label: 'Lost', value: 'lost' },
      ],
      access: { update: salesCanUpdate },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      filterOptions: () => ({ role: { in: ['admin', 'sales'] } }),
      access: { update: salesCanUpdate },
    },
    { name: 'notes', type: 'textarea', access: { update: salesCanUpdate } },
    {
      name: 'followUpAt',
      type: 'date',
      index: true,
      access: { update: salesCanUpdate },
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      access: { read: hasRoleField('admin'), update: () => false },
      admin: { readOnly: true, position: 'sidebar' },
      custom: { 'plugin-import-export': { disabled: true } },
    },
  ],
}
```

Replace the `locale` options with the codes from `src/i18n/locales.ts` if the project is not English and Arabic. `options` must stay a static list in the collection config; do not import a function that reads the request.

There is no revalidation hook. Do not add `versions`.

`email` uses Payload's email field type. The public form still validates with Zod before this collection sees the value.

After adding the collection, run `pnpm generate:types` so `Lead` exists. Until that file exists, type the hook argument as `Record<string, unknown>` only long enough to generate types, then switch it to `Lead`.
