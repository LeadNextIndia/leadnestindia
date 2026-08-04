import { redirect } from 'next/navigation'
import { getSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { LogoutButton } from '@/components/logout-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { type Features, withDefaults } from '@/lib/features'
import { getTenantBranding } from '@/lib/branding'
import { listModulesForTenant, type ModuleSummary } from '@/lib/lead-modules'

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  if (!session.tenantId && !session.isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[var(--background)] px-6">
        <div className="max-w-md w-full rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">You&apos;re not part of a store yet</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Your account (<span className="font-medium text-gray-700 dark:text-gray-200">{session.user.email}</span>) exists,
            but no store admin has added you yet.
          </p>
          <div className="mt-6"><LogoutButton /></div>
        </div>
      </div>
    )
  }

  // Fetch tenant features + branding + modules (null for superadmins without a tenant)
  let features: Features | null = null
  let tenantName: string | null = null
  let backgroundUrl: string | null = null
  let modules: ModuleSummary[] = []
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

    modules = await listModulesForTenant(supabase, session.tenantId)
  }

  const initial = (session.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[var(--background)]">
      <Sidebar
        role={session.role}
        isSuperadmin={session.isSuperadmin}
        features={features}
        tenantName={tenantName}
        modules={modules}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200/70 dark:border-[var(--border)] bg-white/60 dark:bg-[var(--surface)]/70 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {tenantName ? (
              <>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {tenantName}
                </span>
                {!session.isSuperadmin && session.role && (
                  <span className="text-[10px] uppercase tracking-wider bg-gray-100 dark:bg-[var(--surface-muted)] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[var(--border)] rounded-full px-2 py-0.5">
                    {session.role}
                  </span>
                )}
                {session.isSuperadmin && (
                  <span className="text-[10px] uppercase tracking-wider brand-gradient text-white rounded-full px-2 py-0.5 shadow-sm shadow-indigo-500/25">
                    Superadmin
                  </span>
                )}
              </>
            ) : session.isSuperadmin ? (
              <span className="text-[10px] uppercase tracking-wider brand-gradient text-white rounded-full px-2 py-0.5 shadow-sm shadow-indigo-500/25">
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
              className="w-8 h-8 rounded-full brand-gradient text-white text-xs font-semibold flex items-center justify-center shadow-md shadow-indigo-500/25 ring-2 ring-white dark:ring-[var(--surface)]"
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
