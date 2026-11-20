# Authentication, RBAC, OTP Password Reset & First-Login Force Change

Complete implementation templates for Super Admin seeding, Role-Based Access Control (RBAC), 6-digit OTP forgot-password via Resend API, first-login forced password update, and completely hiding API URLs/tabs from the Admin UI.

## 1. Environment Variables (`.env.example`)

```env
# Payload Core
PAYLOAD_SECRET=your-32-char-secret-key-here
NEXT_PUBLIC_SERVER_URL=http://localhost:3000

# Super Admin Credentials (Auto-seeded on startup)
SUPER_ADMIN_EMAIL=admin@clientdomain.com
SUPER_ADMIN_PASSWORD=ChangeMeImmediately123!

# Database (Default: Turso / libSQL)
DATABASE_URL=file:./data/payload.db
# Production Turso:
# DATABASE_URL=libsql://your-db-name.turso.io
# DATABASE_AUTH_TOKEN=your-turso-auth-token

# Email (Resend API)
RESEND_API_KEY=re_123456789
EMAIL_FROM_ADDRESS=noreply@clientdomain.com
EMAIL_FROM_NAME=Client Brand CMS

# Media Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## 2. Users Collection with RBAC, OTP Reset & Force Password Change

Create `src/collections/Users.ts`:

```ts
import type { CollectionConfig, Access } from 'payload'
import crypto from 'crypto'

export const isSuperAdmin: Access = ({ req: { user } }) => {
  return Boolean(user?.roles?.includes('super-admin'))
}

export const isAdminOrSuperAdmin: Access = ({ req: { user } }) => {
  return Boolean(
    user?.roles?.includes('super-admin') || user?.roles?.includes('admin'),
  )
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 7200, // 2 hours
    maxLoginAttempts: 5,
    lockTime: 600000, // 10 minutes
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'roles', 'mustChangePassword', 'createdAt'],
    group: 'System',
    // Strictly hide API URL and API Tab from both Admin and Super Admin
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          api: {
            tab: {
              condition: () => false,
            },
          },
        },
      },
    },
  },
  access: {
    admin: isAdminOrSuperAdmin,
    create: isAdminOrSuperAdmin,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('super-admin') || user.roles?.includes('admin')) {
        return true
      }
      return { id: { equals: user.id } }
    },
    update: ({ req: { user }, id }) => {
      if (!user) return false
      if (user.roles?.includes('super-admin')) return true
      // Regular admins can update themselves or non-super-admins
      if (user.roles?.includes('admin')) {
        return true
      }
      return user.id === id
    },
    delete: isSuperAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc }) => {
        // When a user updates their password, clear mustChangePassword flag
        if (operation === 'update' && data.password) {
          data.mustChangePassword = false
          data.resetOtpHash = null
          data.resetOtpExpires = null
        }
        return data
      },
    ],
  },
  endpoints: [
    {
      path: '/request-otp',
      method: 'post',
      handler: async (req) => {
        const body = await req.json?.() || {}
        const email = body.email?.trim()?.toLowerCase()
        if (!email) {
          return Response.json({ error: 'Email is required' }, { status: 400 })
        }

        const { docs } = await req.payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
        })

        // Always return 200 to prevent user enumeration
        if (!docs.length) {
          return Response.json({ message: 'If the email exists, an OTP code was sent.' })
        }

        const user = docs[0]
        // Generate 6-digit numeric OTP
        const otpCode = crypto.randomInt(100000, 999999).toString()
        const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex')
        const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins

        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: {
            resetOtpHash: otpHash,
            resetOtpExpires: expires,
          },
        })

        await req.payload.sendEmail({
          to: email,
          subject: 'Your Password Reset Verification Code',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="margin-top: 0; color: #111827;">Password Reset Code</h2>
              <p style="color: #374151;">Use the 6-digit verification code below to reset your admin password. This code expires in 10 minutes.</p>
              <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 6px; color: #111827; margin: 20px 0;">
                ${otpCode}
              </div>
              <p style="font-size: 12px; color: #6b7280;">If you did not request this code, please ignore this email.</p>
            </div>
          `,
        })

        return Response.json({ message: 'If the email exists, an OTP code was sent.' })
      },
    },
    {
      path: '/verify-otp-reset',
      method: 'post',
      handler: async (req) => {
        const body = await req.json?.() || {}
        const email = body.email?.trim()?.toLowerCase()
        const code = body.code?.trim()
        const newPassword = body.newPassword

        if (!email || !code || !newPassword || newPassword.length < 8) {
          return Response.json(
            { error: 'Valid email, 6-digit code, and password (min 8 chars) are required.' },
            { status: 400 },
          )
        }

        const { docs } = await req.payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
        })

        if (!docs.length) {
          return Response.json({ error: 'Invalid or expired code.' }, { status: 400 })
        }

        const user = docs[0] as any
        const incomingHash = crypto.createHash('sha256').update(code).digest('hex')
        const now = new Date()

        if (
          !user.resetOtpHash ||
          user.resetOtpHash !== incomingHash ||
          !user.resetOtpExpires ||
          new Date(user.resetOtpExpires) < now
        ) {
          return Response.json({ error: 'Invalid or expired code.' }, { status: 400 })
        }

        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: {
            password: newPassword,
            mustChangePassword: false,
            resetOtpHash: null,
            resetOtpExpires: null,
          },
        })

        return Response.json({ message: 'Password updated successfully.' })
      },
    },
  ],
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Super Admin', value: 'super-admin' },
        { label: 'Admin', value: 'admin' },
      ],
      defaultValue: ['admin'],
      required: true,
      saveToJWT: true,
      access: {
        // Only super-admin can grant super-admin role
        update: ({ req: { user }, data }) => {
          if (user?.roles?.includes('super-admin')) return true
          if (data?.roles?.includes('super-admin')) return false
          return Boolean(user?.roles?.includes('admin'))
        },
      },
    },
    {
      name: 'mustChangePassword',
      type: 'checkbox',
      label: 'Require Password Change on Next Login',
      defaultValue: true,
      saveToJWT: true,
      admin: {
        position: 'sidebar',
        description: 'Forces the admin user to set a new password upon their first login.',
      },
    },
    {
      name: 'resetOtpHash',
      type: 'text',
      hidden: true,
    },
    {
      name: 'resetOtpExpires',
      type: 'date',
      hidden: true,
    },
  ],
}
```

## 3. Super Admin Auto-Seed (`onInit` in `payload.config.ts`)

Always include this helper inside `onInit` in `src/payload.config.ts` so the Super Admin from `.env` is guaranteed to exist:

```ts
export async function ensureSuperAdmin(payload: any) {
  const email = process.env.SUPER_ADMIN_EMAIL
  const password = process.env.SUPER_ADMIN_PASSWORD

  if (!email || !password) {
    payload.logger.warn('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env')
    return
  }

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email.toLowerCase().trim() } },
    limit: 1,
  })

  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        name: 'Super Admin',
        email: email.toLowerCase().trim(),
        password,
        roles: ['super-admin'],
        mustChangePassword: true,
      },
    })
    payload.logger.info(`Seeded Super Admin account: ${email}`)
  }
}
```

## 4. First-Login Password Change Enforcer Component

Create `src/components/admin/ForcePasswordChangeGate.tsx` and register it in `admin.components.header` or `admin.components.beforeDashboard` in `payload.config.ts`. It blocks interaction with a high-contrast modal until the logged-in admin changes their initial password:

```tsx
'use client'
import React, { useState } from 'react'
import { useAuth } from '@payloadcms/ui'

export const ForcePasswordChangeGate: React.FC = () => {
  const { user, refreshCookieAsync } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)

  if (!user || !(user as any).mustChangePassword || completed) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: newPassword,
          mustChangePassword: false,
        }),
      })
      if (!res.ok) {
        throw new Error('Failed to update password.')
      }
      if (refreshCookieAsync) await refreshCookieAsync()
      setCompleted(true)
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Error updating password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'var(--theme-elevation-100)',
          color: 'var(--theme-text)',
          padding: '32px',
          borderRadius: '12px',
          maxWidth: '440px',
          width: '100%',
          border: '1px solid var(--theme-elevation-250)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '20px' }}>
          Security Update Required
        </h2>
        <p style={{ marginBottom: '20px', fontSize: '14px', opacity: 0.85 }}>
          Since this is your first login, please set a new personal password before accessing the dashboard.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--theme-elevation-300)',
                background: 'var(--theme-input-bg)',
                color: 'var(--theme-text)',
              }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--theme-elevation-300)',
                background: 'var(--theme-input-bg)',
                color: 'var(--theme-text)',
              }}
            />
          </div>
          {error && (
            <p style={{ color: 'var(--theme-error-500)', marginBottom: '16px', fontSize: '13px' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn--style-primary btn--size-medium"
            style={{ width: '100%', cursor: 'pointer' }}
          >
            {loading ? 'Updating...' : 'Save New Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
export default ForcePasswordChangeGate
```

## 5. OTP Password Reset Component (`beforeLogin`)

Create `src/components/admin/OtpPasswordResetModal.tsx` and mount it in `admin.components.afterLogin` so admins can click "Forgot Password (OTP Code)" on the login screen, enter their email, receive the 6-digit code via Resend, and set a new password directly.

```tsx
'use client'
import React, { useState } from 'react'

export const OtpPasswordResetModal: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'request' | 'verify' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/users/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setMessage('A 6-digit verification code has been sent to your email.')
      setStep('verify')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/users/verify-otp-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--theme-text)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Forgot password? Reset via Email Code (OTP)
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid var(--theme-elevation-250)',
        background: 'var(--theme-elevation-50)',
      }}
    >
      {step === 'request' && (
        <form onSubmit={handleRequestOtp}>
          <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Reset Password via Email Code</h4>
          <input
            type="email"
            placeholder="Enter your admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '12px',
              borderRadius: '6px',
              border: '1px solid var(--theme-elevation-300)',
              background: 'var(--theme-input-bg)',
              color: 'var(--theme-text)',
            }}
          />
          {error && <p style={{ color: 'var(--theme-error-500)', fontSize: '12px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={loading} className="btn btn--style-primary btn--size-small">
              {loading ? 'Sending...' : 'Send 6-Digit Code'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn--style-secondary btn--size-small">
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyOtp}>
          <h4 style={{ marginTop: 0, marginBottom: '8px' }}>Enter 6-Digit Code</h4>
          <p style={{ fontSize: '12px', marginBottom: '12px' }}>{message}</p>
          <input
            type="text"
            placeholder="6-digit OTP code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={6}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              letterSpacing: '4px',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid var(--theme-elevation-300)',
              background: 'var(--theme-input-bg)',
              color: 'var(--theme-text)',
            }}
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '12px',
              borderRadius: '6px',
              border: '1px solid var(--theme-elevation-300)',
              background: 'var(--theme-input-bg)',
              color: 'var(--theme-text)',
            }}
          />
          {error && <p style={{ color: 'var(--theme-error-500)', fontSize: '12px' }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn btn--style-primary btn--size-small">
            {loading ? 'Verifying...' : 'Verify & Update Password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div>
          <p style={{ color: 'var(--theme-success-500)', fontWeight: 600 }}>
            Password updated! You can now log in above with your new password.
          </p>
          <button type="button" onClick={() => { setOpen(false); setStep('request') }} className="btn btn--style-secondary btn--size-small">
            Close
          </button>
        </div>
      )}
    </div>
  )
}
export default OtpPasswordResetModal
```

## 6. Global Helper to Hide API URLs & Tabs on Every Collection/Global

Always wrap collections and globals with this utility so neither Admin nor Super Admin ever sees the REST/GraphQL API URL or API inspection tab in the CMS dashboard:

```ts
import type { CollectionConfig, GlobalConfig } from 'payload'

export function withHiddenAPI<T extends CollectionConfig | GlobalConfig>(config: T): T {
  return {
    ...config,
    admin: {
      ...config.admin,
      hideAPIURL: true,
      components: {
        ...(config.admin?.components || {}),
        views: {
          ...(config.admin?.components?.views || {}),
          edit: {
            ...((config.admin?.components?.views as any)?.edit || {}),
            api: {
              tab: {
                condition: () => false,
              },
            },
          },
        },
      },
    },
  }
}
```
