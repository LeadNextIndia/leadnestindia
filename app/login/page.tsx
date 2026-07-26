'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  SparkleIcon,
  LayoutIcon,
  UsersIcon,
  DownloadIcon,
  ShieldIcon,
  FileIcon,
  SettingsIcon,
} from '@/components/icons'

// ─── Feature catalog (what the app does today) ───────────────────────
// Kept in one place so this stays in sync with the app's real capabilities.
type Feature = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  tier?: 'core' | 'paid'
}

const FEATURES: Feature[] = [
  {
    icon: LayoutIcon,
    title: 'Lead dashboard',
    desc: 'Every walk-in and online inquiry in one searchable, filterable table.',
    tier: 'core',
  },
  {
    icon: SettingsIcon,
    title: 'Custom fields per company',
    desc: 'Superadmin defines any set of fields — Real Estate, Retail, Auto — per tenant.',
    tier: 'core',
  },
  {
    icon: UsersIcon,
    title: 'Roles & team invites',
    desc: 'Three tiers (superadmin / admin / user) with email-invite onboarding.',
    tier: 'core',
  },
  {
    icon: UsersIcon,
    title: 'Assignment & follow-ups',
    desc: 'Assign leads, set follow-up dates, see overdue + due-today at a glance.',
    tier: 'core',
  },
  {
    icon: LayoutIcon,
    title: 'Notes & activity timeline',
    desc: 'Team notes on each lead plus an auto-logged history of status/assignee/edits.',
    tier: 'paid',
  },
  {
    icon: DownloadIcon,
    title: 'CSV export',
    desc: 'One-click export of your leads — the current filter carries through.',
    tier: 'core',
  },
  {
    icon: LayoutIcon,
    title: 'Analytics & charts',
    desc: 'Status pie, 14-day trend, advanced multi-condition filter, saved views.',
    tier: 'paid',
  },
  {
    icon: FileIcon,
    title: 'GST-compliant invoicing',
    desc: 'Generate tax invoices from any lead. CGST + SGST or IGST, print / download PDF.',
    tier: 'paid',
  },
  {
    icon: ShieldIcon,
    title: 'Row-Level Security',
    desc: 'Each company sees only its own data — enforced at the database.',
    tier: 'core',
  },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-gray-50 dark:bg-[var(--background)]">
      {/* ── Brand + feature showcase ────────────────────────────── */}
      <aside className="hidden lg:flex relative flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-indigo-700 via-blue-700 to-blue-900 text-white overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-300 blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-white/20 backdrop-blur flex items-center justify-center">
              <SparkleIcon className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">LeadNest</div>
              <div className="text-[10px] uppercase tracking-widest text-white/70">India</div>
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <h1 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight">
            Every customer inquiry, <span className="text-indigo-200">one dashboard.</span>
          </h1>
          <p className="mt-3 text-white/80 text-sm xl:text-base leading-relaxed">
            The complete lead-management platform for small Indian businesses — from capture to
            follow-up to GST-compliant invoice. Multi-tenant, role-aware, and customisable per company.
          </p>

          {/* Feature grid */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} f={f} />
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/60">
          <div>© {new Date().getFullYear()} LeadNestIndia</div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </aside>

      {/* ── Sign-in / reset form ────────────────────────────────── */}
      <main className="flex flex-col justify-center p-6 sm:p-10 bg-white dark:bg-[var(--surface)]">
        {/* Mobile brand strip (hidden on desktop where the left panel takes over) */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center">
            <SparkleIcon className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">LeadNest India</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Lead management for SMBs
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <Suspense fallback={<FormSkeleton />}>
            <LoginForm />
          </Suspense>

          {/* Mobile feature summary */}
          <div className="lg:hidden mt-10 pt-6 border-t border-gray-200 dark:border-[var(--border)]">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              What you can do inside
            </div>
            <ul className="grid grid-cols-1 gap-2">
              {FEATURES.slice(0, 6).map((f) => {
                const Icon = f.icon
                return (
                  <li key={f.title} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      <strong className="text-gray-900 dark:text-gray-100">{f.title}</strong>
                      {' — '}
                      <span className="text-gray-500 dark:text-gray-400">{f.desc}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Feature card (used in the desktop hero grid) ────────────────────
function FeatureCard({ f }: { f: Feature }) {
  const Icon = f.icon
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur border border-white/15 px-3 py-2.5 hover:bg-white/15 transition">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-sm font-medium text-white">{f.title}</div>
        {f.tier === 'paid' && (
          <span className="ml-auto text-[9px] uppercase tracking-wider bg-amber-300/20 text-amber-100 border border-amber-200/30 rounded px-1.5 py-0.5">
            Paid
          </span>
        )}
      </div>
      <p className="text-[11px] text-white/70 leading-snug">{f.desc}</p>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome back</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your LeadNest dashboard.</p>
      </div>
      <div className="animate-pulse space-y-3">
        <div className="h-9 rounded-md bg-gray-100 dark:bg-[var(--surface-muted)]" />
        <div className="h-9 rounded-md bg-gray-100 dark:bg-[var(--surface-muted)]" />
        <div className="h-10 rounded-md bg-gray-200 dark:bg-[var(--surface-muted)]" />
      </div>
    </div>
  )
}

type Mode = 'signin' | 'reset'

function LoginForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => searchParams.get('error'))
  const [info, setInfo] = useState<string | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      setError('Sign-in did not return a session.')
      setLoading(false)
      return
    }
    window.location.assign('/dashboard')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setInfo('Check your email — we sent a link to set your password.')
  }

  if (mode === 'reset') {
    return (
      <form onSubmit={handleReset} className="w-full space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Set your password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enter your email and we&apos;ll send a link to set or reset your password.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && <Alert kind="err">{error}</Alert>}
        {info && <Alert kind="ok">{info}</Alert>}

        <button
          type="submit"
          disabled={loading}
          className={primaryBtn}
        >
          {loading ? 'Sending…' : 'Send password link'}
        </button>

        <div className="text-center text-xs">
          <button type="button" onClick={() => switchMode('signin')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
            ← Back to sign in
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSignIn} className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome back</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sign in to your LeadNest dashboard.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Password</label>
            <button
              type="button"
              onClick={() => switchMode('reset')}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Forgot / first time?
            </button>
          </div>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
      </div>

      {error && <Alert kind="err">{error}</Alert>}

      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="pt-1 text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        Don&apos;t have an account?
        <br />
        LeadNest is <strong className="text-gray-700 dark:text-gray-300">invite-only</strong> —
        ask your company admin to send you one.
      </div>
    </form>
  )
}

// ─── Shared UI atoms ────────────────────────────────────────────────
const inputCls =
  'w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition'

const primaryBtn =
  'w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md px-3 py-2.5 transition shadow-sm hover:shadow'

function Alert({ kind, children }: { kind: 'ok' | 'err'; children: React.ReactNode }) {
  const cls =
    kind === 'ok'
      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30'
      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30'
  return (
    <p className={`text-sm border rounded-md px-3 py-2 ${cls}`}>
      {children}
    </p>
  )
}
