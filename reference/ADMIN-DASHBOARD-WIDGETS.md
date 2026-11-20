# Dynamic Executive Analytics Dashboard (`beforeDashboard`)

Every Payload CMS project MUST include a clean, high-contrast Executive Analytics Dashboard at the top of the Admin Panel home screen (`admin.components.beforeDashboard`). The dashboard automatically inspects which collections exist in the current project and displays live KPI cards and recent activity tables tailored to the website's domain (e.g., Registered Users, Courses & Course Bookings, Blog Posts/Articles, Form Leads, Orders/Revenue, and Pages).

## 1. How Adaptive KPI Detection Works

Because different client websites have different modules (some have Courses & Bookings, some have Blogs/Articles, some have E-commerce Orders, and all have Pages, Users, and Form Submissions), the Server Component checks `payload.collections[slug]` dynamically before running `payload.count()`:

- **Always Shown**:
  - **Published Pages** (`pages`)
  - **Registered Users / Members** (`users` — broken down by total registered users/students vs admins if roles exist)
  - **Form Submissions / New Leads** (`form-submissions` — total + unread `status: 'new'`)
- **Shown Automatically When Courses / Bookings Exist** (`courses`, `bookings` / `course-bookings` / `enrollments`):
  - **Available Courses** (`courses` count)
  - **Total Course Bookings / Enrollments** (`course-bookings` or `bookings` or `enrollments` count + confirmed/paid count)
- **Shown Automatically When Blog / Articles Exist** (`posts` / `articles` / `blogs`):
  - **Published Articles / Blog Posts** (`posts` or `articles` count)
- **Shown Automatically When Paymob Orders Exist** (`orders`):
  - **Paid Orders & Total Revenue** (`orders` where `status: 'paid'`)

## 2. Server Component Implementation (`src/components/admin/ExecutiveDashboard.tsx`)

Create `src/components/admin/ExecutiveDashboard.tsx` as a Payload Server Component (no `'use client'` needed, so it queries `payload.count()` and `payload.find()` directly on the server with zero client bundle overhead):

```tsx
// src/components/admin/ExecutiveDashboard.tsx
import React from 'react'
import type { AdminViewServerProps } from 'payload'

interface KpiMetric {
  label: string
  value: string | number
  subtext: string
  href?: string
  accent: string
}

export const ExecutiveDashboard: React.FC<AdminViewServerProps> = async ({ payload, user }) => {
  if (!user || !payload) return null

  const collections = payload.collections || {}
  const hasCollection = (slug: string) => Boolean(collections[slug])

  const metrics: KpiMetric[] = []

  // 1. Registered Users / Members Count
  if (hasCollection('users')) {
    const totalUsers = await payload.count({ collection: 'users' as any })
    metrics.push({
      label: 'Registered Users',
      value: totalUsers.totalDocs,
      subtext: 'Total accounts in system',
      href: '/admin/collections/users',
      accent: '#2563eb',
    })
  }

  // 2. Courses & Course Bookings (if site has courses / bookings)
  const courseSlug = ['courses', 'programs', 'trainings'].find(hasCollection)
  if (courseSlug) {
    const totalCourses = await payload.count({ collection: courseSlug as any })
    metrics.push({
      label: 'Active Courses',
      value: totalCourses.totalDocs,
      subtext: 'Total courses on website',
      href: `/admin/collections/${courseSlug}`,
      accent: '#7c3aed',
    })
  }

  const bookingSlug = ['course-bookings', 'bookings', 'enrollments', 'registrations'].find(
    hasCollection,
  )
  if (bookingSlug) {
    const totalBookings = await payload.count({ collection: bookingSlug as any })
    metrics.push({
      label: 'Booked Courses',
      value: totalBookings.totalDocs,
      subtext: 'Total student reservations',
      href: `/admin/collections/${bookingSlug}`,
      accent: '#059669',
    })
  }

  // 3. Blog Posts / Articles (if site has a blog)
  const blogSlug = ['posts', 'articles', 'blogs', 'news'].find(hasCollection)
  if (blogSlug) {
    const totalPosts = await payload.count({ collection: blogSlug as any })
    metrics.push({
      label: 'Blog Articles',
      value: totalPosts.totalDocs,
      subtext: 'Total articles in CMS',
      href: `/admin/collections/${blogSlug}`,
      accent: '#d97706',
    })
  }

  // 4. Website Pages
  if (hasCollection('pages')) {
    const totalPages = await payload.count({ collection: 'pages' as any })
    metrics.push({
      label: 'Website Pages',
      value: totalPages.totalDocs,
      subtext: 'Dynamic layout pages',
      href: '/admin/collections/pages',
      accent: '#0284c7',
    })
  }

  // 5. Form Submissions / Leads
  if (hasCollection('form-submissions')) {
    const totalLeads = await payload.count({ collection: 'form-submissions' as any })
    const newLeads = await payload
      .count({
        collection: 'form-submissions' as any,
        where: { status: { equals: 'new' } },
      })
      .catch(() => ({ totalDocs: 0 }))

    metrics.push({
      label: 'Form Submissions',
      value: totalLeads.totalDocs,
      subtext: `${newLeads.totalDocs} unread / new leads`,
      href: '/admin/collections/form-submissions',
      accent: '#e11d48',
    })
  }

  // 6. Paymob Orders / Payments (if enabled)
  if (hasCollection('orders')) {
    const paidOrders = await payload
      .count({
        collection: 'orders' as any,
        where: { status: { equals: 'paid' } },
      })
      .catch(() => ({ totalDocs: 0 }))

    metrics.push({
      label: 'Completed Payments',
      value: paidOrders.totalDocs,
      subtext: 'Verified paid orders',
      href: '/admin/collections/orders',
      accent: '#16a34a',
    })
  }

  // Fetch 5 most recent bookings or form submissions for quick overview table
  const activitySlug = bookingSlug || (hasCollection('form-submissions') ? 'form-submissions' : null)
  const recentActivity = activitySlug
    ? await payload
        .find({
          collection: activitySlug as any,
          limit: 5,
          sort: '-createdAt',
        })
        .catch(() => ({ docs: [] }))
    : { docs: [] }

  return (
    <section
      style={{
        marginBottom: '32px',
        padding: '24px',
        borderRadius: '12px',
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-150)',
        color: 'var(--theme-text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--theme-text)' }}>
            Welcome back, {(user as any).name || user.email}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--theme-elevation-500)' }}>
            Live overview of your website content, registrations, and activity
          </p>
        </div>
        {hasCollection('form-submissions') && (
          <a
            href="/api/form-submissions/export-csv"
            download
            className="btn btn--style-primary btn--size-small export-csv-btn"
            style={{ textDecoration: 'none', margin: 0 }}
          >
            ⬇ Export Leads CSV
          </a>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: recentActivity.docs.length > 0 ? '24px' : '0',
        }}
      >
        {metrics.map((m) => (
          <a
            key={m.label}
            href={m.href || '#'}
            style={{
              display: 'block',
              textDecoration: 'none',
              padding: '20px',
              borderRadius: '10px',
              background: 'var(--theme-elevation-0)',
              border: '1px solid var(--theme-elevation-150)',
              borderTop: `4px solid ${m.accent}`,
              color: 'var(--theme-text)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--theme-elevation-500)',
                marginBottom: '8px',
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
                lineHeight: 1.1,
                color: 'var(--theme-text)',
                marginBottom: '6px',
              }}
            >
              {m.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--theme-elevation-400)' }}>
              {m.subtext}
            </div>
          </a>
        ))}
      </div>

      {/* Recent Bookings / Leads Mini-Table */}
      {recentActivity.docs.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: 'var(--theme-text)' }}>
            Recent {bookingSlug ? 'Course Bookings' : 'Form Submissions'}
          </h3>
          <div className="table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name / Reference</th>
                  <th style={{ textAlign: 'left' }}>Email / Contact</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'left' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.docs.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      <a
                        href={`/admin/collections/${activitySlug}/${item.id}`}
                        style={{ fontWeight: 600, color: 'var(--theme-text)', textDecoration: 'underline' }}
                      >
                        {item.studentName || item.senderName || item.customerName || item.title || item.id}
                      </a>
                    </td>
                    <td>{item.studentEmail || item.senderEmail || item.customerEmail || '—'}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'var(--theme-elevation-150)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        {item.status || 'Submitted'}
                      </span>
                    </td>
                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default ExecutiveDashboard
```

## 3. Registering the Dashboard in `payload.config.ts`

```ts
admin: {
  components: {
    graphics: {
      Logo: '/components/admin/Logo',
      Icon: '/components/admin/Icon',
    },
    header: ['/components/admin/ForcePasswordChangeGate'],
    beforeDashboard: ['/components/admin/ExecutiveDashboard'],
    afterLogin: ['/components/admin/OtpPasswordResetModal'],
  },
}
```
