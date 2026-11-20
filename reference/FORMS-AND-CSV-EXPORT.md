# Form Submissions Table & One-Click CSV Export

Whenever the frontend contains any form (contact, quote request, booking, newsletter, career application), store submissions in the database and display them in a clean, detailed table inside the Payload CMS Admin Panel with a one-click CSV Export button.

## 1. Form Submissions Collection with Built-In CSV Export Endpoint

Create `src/collections/FormSubmissions.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { withHiddenAPI } from '@/lib/withHiddenAPI'
import { isAdminOrSuperAdmin } from './Users'

export const FormSubmissions: CollectionConfig = withHiddenAPI({
  slug: 'form-submissions',
  labels: {
    singular: 'Form Submission',
    plural: 'Form Submissions',
  },
  admin: {
    useAsTitle: 'senderName',
    defaultColumns: ['formName', 'senderName', 'senderEmail', 'senderPhone', 'status', 'createdAt'],
    group: 'Forms & Leads',
    components: {
      beforeListTable: ['/components/admin/ExportSubmissionsCsvButton'],
    },
  },
  access: {
    // Public frontend can submit forms
    create: () => true,
    // Only Admins & Super Admins can view, update status, or delete
    read: isAdminOrSuperAdmin,
    update: isAdminOrSuperAdmin,
    delete: isAdminOrSuperAdmin,
  },
  endpoints: [
    {
      path: '/export-csv',
      method: 'get',
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { docs } = await req.payload.find({
          collection: 'form-submissions',
          limit: 10000,
          sort: '-createdAt',
        })

        // Collect all dynamic field keys across submissions
        const dynamicKeys = new Set<string>()
        docs.forEach((doc: any) => {
          if (Array.isArray(doc.submissionData)) {
            doc.submissionData.forEach((item: any) => {
              if (item?.field) dynamicKeys.add(item.field)
            })
          }
        })

        const baseHeaders = [
          'ID',
          'Form Name',
          'Sender Name',
          'Sender Email',
          'Sender Phone',
          'Status',
          'Submitted At',
        ]
        const extraHeaders = Array.from(dynamicKeys)
        const allHeaders = [...baseHeaders, ...extraHeaders]

        const escapeCsv = (val: unknown) => {
          if (val === null || val === undefined) return '""'
          const str = String(val).replace(/"/g, '""')
          return `"${str}"`
        }

        const rows = docs.map((doc: any) => {
          const dataMap: Record<string, string> = {}
          if (Array.isArray(doc.submissionData)) {
            doc.submissionData.forEach((item: any) => {
              if (item?.field) dataMap[item.field] = item.value || ''
            })
          }

          return [
            escapeCsv(doc.id),
            escapeCsv(doc.formName),
            escapeCsv(doc.senderName),
            escapeCsv(doc.senderEmail),
            escapeCsv(doc.senderPhone),
            escapeCsv(doc.status),
            escapeCsv(doc.createdAt),
            ...extraHeaders.map((k) => escapeCsv(dataMap[k] || '')),
          ].join(',')
        })

        // Prepend UTF-8 BOM (\uFEFF) so Arabic and international characters open cleanly in Excel
        const csvContent = '\uFEFF' + [allHeaders.map(escapeCsv).join(','), ...rows].join('\n')

        return new Response(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="form-submissions-${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        })
      },
    },
  ],
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'formName',
          type: 'text',
          required: true,
          defaultValue: 'Contact Form',
          admin: { width: '50%' },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'new',
          options: [
            { label: 'New', value: 'new' },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Resolved', value: 'resolved' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'senderName', type: 'text', label: 'Name', admin: { width: '33%' } },
        { name: 'senderEmail', type: 'email', label: 'Email', admin: { width: '33%' } },
        { name: 'senderPhone', type: 'text', label: 'Phone', admin: { width: '34%' } },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      label: 'Primary Message',
    },
    {
      name: 'submissionData',
      type: 'array',
      label: 'All Submitted Form Fields',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'field', type: 'text', required: true, admin: { width: '40%' } },
            { name: 'value', type: 'textarea', required: true, admin: { width: '60%' } },
          ],
        },
      ],
    },
  ],
  timestamps: true,
})
```

## 2. CSV Export Button Component (`src/components/admin/ExportSubmissionsCsvButton.tsx`)

```tsx
'use client'
import React from 'react'

export const ExportSubmissionsCsvButton: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '16px',
      }}
    >
      <a
        href="/api/form-submissions/export-csv"
        download
        className="btn btn--style-primary btn--size-small export-csv-btn"
        style={{
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>⬇ Export All to CSV (Excel Ready)</span>
      </a>
    </div>
  )
}
export default ExportSubmissionsCsvButton
```
