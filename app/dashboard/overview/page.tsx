import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { withDefaults, type Features } from '@/lib/features'
import { LayoutIcon } from '@/components/icons'
import { LeadsCharts } from '@/components/leads-charts'

export const dynamic = 'force-dynamic'

type Lead = {
  id: string
  created_at: string
  status: string | null
  assigned_to: string | null
  follow_up_at: string | null
  custom_data: Record<string, unknown> | null
}

export default async function DashboardOverviewPage() {
  const session = await requireSession()
  if (!session.tenantId) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: leadsRaw }, { data: tenantRow }] = await Promise.all([
    supabase
      .from('leads')
      .select('id,created_at,status,assigned_to,follow_up_at,custom_data')
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tenants')
      .select('features, display_name, name')
      .eq('id', session.tenantId)
      .maybeSingle(),
  ])

  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features
  )

  // Server-side feature-flag re-check — never trust the sidebar's client visibility.
  if (!session.isSuperadmin && !features.dashboard) {
    redirect('/dashboard')
  }

  const leads = (leadsRaw ?? []) as Lead[]

  const displayName =
    (tenantRow as { display_name?: string | null; name?: string | null } | null)?.display_name ||
    (tenantRow as { name?: string | null } | null)?.name ||
    'Your store'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <LayoutIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Analytics for <span className="font-medium text-gray-700 dark:text-gray-200">{displayName}</span>.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] text-gray-800 dark:text-gray-100 rounded-md px-3 py-1.5 transition"
        >
          Go to Leads →
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-[var(--border)] p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No leads yet. Once you start adding leads, charts will populate here.
        </div>
      ) : (
        <LeadsCharts leads={leads} />
      )}
    </div>
  )
}
