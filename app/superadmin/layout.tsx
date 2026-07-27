import { requireSuperadmin } from '@/lib/authz'
import { LogoutButton } from '@/components/logout-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { SuperadminSidebar } from '@/components/superadmin-sidebar'

export default async function SuperadminLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireSuperadmin()
  const initial = (session.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[var(--background)]">
      <SuperadminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] flex items-center justify-end gap-3 px-6">
          <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 truncate max-w-[240px]">
            {session.user.email}
          </span>
          <ThemeToggle />
          <LogoutButton />
          <div
            title={session.user.email ?? undefined}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-xs font-semibold flex items-center justify-center"
          >
            {initial}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
