import { redirect } from 'next/navigation'
import { getSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { LogoutButton } from '@/components/logout-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { type Features, withDefaults } from '@/lib/features'
import { getTenantBranding } from '@/lib/branding'

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  if (!session.tenantId && !session.isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">You&apos;re not part of a store yet</h1>
          <p className="text-sm text-gray-500 mt-2">
            Your account (<span className="font-medium text-gray-700">{session.user.email}</span>) exists,
            but no store admin has added you yet.
          </p>
          <div className="mt-6"><LogoutButton /></div>
        </div>
      </div>
    )
  }

  // Fetch tenant features + branding (null for superadmins without a tenant)
  let features: Features | null = null
  let tenantName: string | null = null
  let backgroundUrl: string | null = null
  if (session.tenantId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tenants')
      .select('features')
      .eq('id', session.tenantId)
      .maybeSingle()
    features = withDefaults(data?.features as Partial<Features> | null)

    const branding = await getTenantBranding(session.tenantId)
    tenantName = branding.displayName
    backgroundUrl = branding.backgroundUrl
  }

  const initial = (session.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[var(--background)]">
      <Sidebar role={session.role} isSuperadmin={session.isSuperadmin} features={features} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] flex items-center justify-between px-6">
          <div className="flex items-center gap-3 min-w-0">
            {tenantName ? (
              <>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {tenantName}
                </span>
                {!session.isSuperadmin && session.role && (
                  <span className="text-[10px] uppercase tracking-wider bg-gray-100 dark:bg-[var(--surface-muted)] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[var(--border)] rounded px-1.5 py-0.5">
                    {session.role}
                  </span>
                )}
                {session.isSuperadmin && (
                  <span className="text-[10px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30 rounded px-1.5 py-0.5">
                    Superadmin
                  </span>
                )}
              </>
            ) : session.isSuperadmin ? (
              <span className="text-[10px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30 rounded px-1.5 py-0.5">
                Superadmin
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 truncate max-w-[240px]">
              {session.user.email}
            </span>
            <ThemeToggle />
            <LogoutButton />
            <div
              title={session.user.email ?? undefined}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-semibold flex items-center justify-center"
            >
              {initial}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-x-hidden relative isolate">
          {backgroundUrl && (
            <>
              <div
                aria-hidden
                className="absolute inset-0 -z-20 pointer-events-none"
                style={{
                  backgroundImage: `url("${backgroundUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundAttachment: 'fixed',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 -z-10 pointer-events-none bg-white/88 dark:bg-[var(--background)]/88"
              />
            </>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
