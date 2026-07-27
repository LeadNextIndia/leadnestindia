'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldIcon, UsersIcon, MailIcon, LayoutIcon } from './icons'
import { cn } from '@/lib/utils'

type Item = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  matchExact?: boolean
}

const items: Item[] = [
  { label: 'Tenants', href: '/superadmin', icon: LayoutIcon, matchExact: true },
  { label: 'Support inbox', href: '/superadmin/support', icon: MailIcon },
  { label: 'User requests', href: '/superadmin/user-requests', icon: UsersIcon },
]

export function SuperadminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] flex flex-col">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-200 dark:border-[var(--border)]">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white">
          <ShieldIcon className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Superadmin</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Platform Control
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active = item.matchExact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[var(--surface-muted)]'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4',
                  active
                    ? 'text-indigo-600 dark:text-indigo-300'
                    : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                )}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t border-gray-200 dark:border-[var(--border)]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[var(--surface-muted)]"
        >
          ← Back to dashboard
        </Link>
      </div>
    </aside>
  )
}
