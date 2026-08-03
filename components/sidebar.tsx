'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutIcon,
  UsersIcon,
  DownloadIcon,
  SettingsIcon,
  ShieldIcon,
  SparkleIcon,
  FileIcon,
  FieldsIcon,
} from './icons'
import { cn } from '@/lib/utils'

import type { Features } from '@/lib/features'
import type { ModuleSummary } from '@/lib/lead-modules'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
  soon?: boolean
  matchExact?: boolean
}

type Props = {
  role: 'admin' | 'user' | null
  isSuperadmin: boolean
  features: Features | null
  tenantName: string | null
  modules: ModuleSummary[]
}

export function Sidebar({ role, isSuperadmin, features, tenantName, modules }: Props) {
  const pathname = usePathname()

  const isAdmin = role === 'admin' || isSuperadmin
  const feat = features ?? {
    team: true, export: true, settings: false,
    analytics: false, invoicing: false, activity: false,
    dashboard: true, field_labels: false, multi_modules: false,
  }

  // Order: [module list] → Dashboard → Field labels → Invoices → Team → Export → Settings → Superadmin
  const items: NavItem[] = []
  if (modules.length > 0) {
    for (const m of modules) {
      items.push({
        label: m.plural,
        href: `/dashboard/m/${m.slug}`,
        icon: LayoutIcon,
      })
    }
  } else {
    // Fallback for tenants whose migration hasn't run yet — link to legacy /dashboard.
    items.push({ label: 'Leads', href: '/dashboard', icon: LayoutIcon, matchExact: true })
  }

  if (feat.dashboard || isSuperadmin) {
    items.push({ label: 'Dashboard', href: '/dashboard/overview', icon: LayoutIcon })
  }
  if (isAdmin && (feat.field_labels || isSuperadmin)) {
    items.push({ label: 'Field labels', href: '/dashboard/field-labels', icon: FieldsIcon })
  }
  if (feat.invoicing || isSuperadmin) {
    items.push({ label: 'Invoices', href: '/dashboard/invoices', icon: FileIcon })
  }
  if (isAdmin && feat.team) {
    items.push({ label: 'Team', href: '/dashboard/team', icon: UsersIcon })
  }
  if (isAdmin && feat.export) {
    // Export goes through the current module's page — this is a shortcut to the default module's export.
    const defaultSlug = modules.find((m) => m.isDefault)?.slug ?? modules[0]?.slug
    if (defaultSlug) {
      items.push({
        label: 'Export',
        href: `/api/export?module=${encodeURIComponent(defaultSlug)}`,
        icon: DownloadIcon,
        external: true,
      })
    }
  }
  if (isAdmin) {
    items.push({ label: 'Settings', href: '/dashboard/settings', icon: SettingsIcon })
  }
  if (isSuperadmin) {
    items.push({ label: 'Superadmin', href: '/superadmin', icon: ShieldIcon })
  }

  return (
    <aside className="w-56 border-r border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] flex flex-col">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-200 dark:border-[var(--border)]">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
          <SparkleIcon className="w-4 h-4" />
        </div>
        <div className="leading-tight min-w-0">
          {isSuperadmin ? (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">LeadNest</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">India</div>
            </>
          ) : tenantName ? (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={tenantName}>
                {tenantName}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Workspace</div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your workspace</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company</div>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active = item.matchExact
            ? pathname === item.href
            : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          const content = (
            <>
              <Icon className={cn('w-4 h-4', active ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700')} />
              <span className="flex-1">{item.label}</span>
              {item.soon && (
                <span className="text-[9px] uppercase tracking-wider text-gray-400 border border-gray-200 rounded px-1 py-0.5">
                  Soon
                </span>
              )}
            </>
          )
          const className = cn(
            'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition',
            active
              ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-500/15 dark:text-blue-300'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[var(--surface-muted)]'
          )
          return item.external ? (
            <a key={item.href} href={item.href} className={className}>{content}</a>
          ) : (
            <Link key={item.href} href={item.href} className={className}>{content}</Link>
          )
        })}
      </nav>

      <div className="px-3 py-3 border-t border-gray-200 dark:border-[var(--border)]">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Version</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">0.1.0 · dev</div>
      </div>
    </aside>
  )
}
