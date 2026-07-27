import Link from 'next/link'
import { requireSuperadmin } from '@/lib/authz'
import { LogoutButton } from '@/components/logout-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { ShieldIcon } from '@/components/icons'

export default async function SuperadminLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireSuperadmin()
  const initial = (session.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--background)] flex flex-col">
      <header className="h-14 border-b border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/superadmin" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center">
              <ShieldIcon className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Superadmin</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Platform Control</div>
            </div>
          </Link>
          <nav className="ml-4 flex items-center gap-1">
            <Link href="/superadmin" className="text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[var(--surface-muted)] rounded px-2 py-1">
              Tenants
            </Link>
            <Link href="/superadmin/support" className="text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[var(--surface-muted)] rounded px-2 py-1">
              Support
            </Link>
            <Link href="/superadmin/user-requests" className="text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[var(--surface-muted)] rounded px-2 py-1">
              User requests
            </Link>
          </nav>
          <Link
            href="/dashboard"
            className="ml-4 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-[var(--border)] rounded px-2 py-1"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
            <span className="font-medium text-gray-800 dark:text-gray-200">{session.user.email}</span>
          </span>
          <ThemeToggle />
          <LogoutButton />
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-xs font-semibold flex items-center justify-center">
            {initial}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  )
}
