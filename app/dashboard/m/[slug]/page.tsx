import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/authz'
import { KpiCard } from '@/components/kpi-card'
import { LeadsTable } from '@/components/leads-table'
import type { SavedView } from '@/components/saved-views-menu'
import type { Member } from '@/components/lead-edit-modal'
import type { LeadFilter } from '@/lib/filters'
import { type Features, withDefaults } from '@/lib/features'
import { NewLeadButton } from '@/components/new-lead-button'
import { getModuleConfig } from '@/lib/lead-modules'

type Lead = {
  id: string
  created_at: string
  status: string | null
  custom_data: Record<string, unknown> | null
  assigned_to: string | null
  follow_up_at: string | null
}

type Props = {
  params: Promise<{ slug: string }>
}

// Extracted so React 19's react-hooks/purity lint doesn't flag Date.now() /
// new Date() inside the component body.
function weekAgoMs(): number {
  return Date.now() - 7 * 24 * 60 * 60 * 1000
}

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export default async function ModuleLeadsPage({ params }: Props) {
  const { slug } = await params
  const [session, supabase] = await Promise.all([getSession(), createClient()])
  if (!session?.tenantId) notFound()

  const config = await getModuleConfig(supabase, session.tenantId, slug)
  if (!config) notFound()

  const canEdit = !!(session.isSuperadmin || session.role === 'admin')

  const [
    { data: leadsRaw },
    { data: savedViewsRaw },
    { data: tenantRow },
    { data: membersRaw },
    { data: columnPrefRow },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id,created_at,status,custom_data,assigned_to,follow_up_at')
      .eq('tenant_id', session.tenantId)
      .eq('module_key', config.slug)
      .order('created_at', { ascending: false }),
    session.user
      ? supabase
          .from('saved_views')
          .select('id,name,filter,created_at')
          .eq('tenant_id', session.tenantId)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('tenants').select('features').eq('id', session.tenantId).maybeSingle(),
    supabase.from('tenant_users').select('user_id,email').eq('tenant_id', session.tenantId),
    session.user
      ? supabase
          .from('user_column_prefs')
          .select('visible_fields')
          .eq('user_id', session.user.id)
          .eq('tenant_id', session.tenantId)
          .eq('view_key', `module:${config.slug}`)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features,
  )
  const analyticsEnabled = !!session.isSuperadmin || features.analytics
  const exportEnabled = !!session.isSuperadmin || features.export
  const invoicingEnabled = !!session.isSuperadmin || features.invoicing
  const activityEnabled = !!session.isSuperadmin || features.activity

  const leads: Lead[] = (leadsRaw ?? []) as Lead[]

  // Field defs come from the module config (label overrides + visibility already applied).
  const fieldDefs = config.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    options: f.options,
  }))

  const savedViews: SavedView[] = ((savedViewsRaw ?? []) as Array<{
    id: string
    name: string
    filter: LeadFilter
    created_at: string
  }>).map((v) => ({
    id: v.id,
    name: v.name,
    filter: v.filter ?? { conditions: [] },
    created_at: v.created_at,
  }))
  const members: Member[] = ((membersRaw ?? []) as Array<{ user_id: string; email: string | null }>)
    .map((m) => ({ user_id: m.user_id, email: m.email }))

  const currentUserId = session.user.id

  const total = leads.length
  const byStatus = (name: string) =>
    leads.filter((l) => (l.status ?? 'new').toLowerCase() === name).length
  const newCount = byStatus('new')
  const wonCount = byStatus('won')
  const lostCount = byStatus('lost')
  const weekAgo = weekAgoMs()
  const thisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length

  const startOfDay = startOfTodayMs()
  const tomorrow = startOfDay + 24 * 3600 * 1000
  const myFollowUps = leads.filter((l) => l.assigned_to === currentUserId && l.follow_up_at)
  const dueToday = myFollowUps.filter((l) => {
    const t = new Date(l.follow_up_at!).getTime()
    return t >= startOfDay && t < tomorrow
  }).length
  const overdue = myFollowUps.filter((l) => new Date(l.follow_up_at!).getTime() < startOfDay).length

  // Dedupe columns by label (case-insensitive) to avoid side-by-side duplicates.
  const columns = (() => {
    if (fieldDefs.length === 0) {
      return Array.from(new Set(leads.flatMap((l) => Object.keys(l.custom_data ?? {}))))
    }
    const seenLabels = new Set<string>()
    const keys: string[] = []
    for (const f of fieldDefs) {
      const label = f.label.trim().toLowerCase()
      if (seenLabels.has(label)) continue
      seenLabels.add(label)
      keys.push(f.key)
    }
    return keys
  })()

  const duplicateHiddenCount = fieldDefs.length - columns.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{config.plural}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            All {config.plural.toLowerCase()} for your store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewLeadButton moduleSlug={config.slug} moduleSingular={config.singular} />
        </div>
      </div>

      {(overdue > 0 || dueToday > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-2.5 flex items-center gap-4 text-sm">
          <span className="font-medium text-amber-800 dark:text-amber-300">Your follow-ups:</span>
          {overdue > 0 && (
            <span className="text-red-700 dark:text-red-400">
              <strong>{overdue}</strong> overdue
            </span>
          )}
          {dueToday > 0 && (
            <span className="text-amber-800 dark:text-amber-300">
              <strong>{dueToday}</strong> due today
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={total} accent="gray" />
        <KpiCard label="This week" value={thisWeek} accent="blue" hint="Last 7 days" />
        <KpiCard label="New" value={newCount} accent="blue" />
        <KpiCard label="Won" value={wonCount} accent="green" />
        <KpiCard label="Lost" value={lostCount} accent="red" />
      </div>

      {duplicateHiddenCount > 0 && (
        <div className="rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>{duplicateHiddenCount}</strong> duplicate field
            {duplicateHiddenCount === 1 ? ' was' : 's were'} auto-hidden from this table.
          </span>
        </div>
      )}

      <LeadsTable
        leads={leads}
        columns={columns}
        fieldDefs={fieldDefs}
        canEdit={canEdit}
        savedViews={savedViews}
        showAnalytics={analyticsEnabled}
        showExport={exportEnabled}
        showInvoicing={invoicingEnabled}
        showActivity={activityEnabled}
        members={members}
        currentUserId={currentUserId}
        initialVisibleColumns={
          (columnPrefRow as { visible_fields?: string[] } | null)?.visible_fields ?? null
        }
        columnViewKey={`module:${config.slug}`}
        exportHrefBase={`/api/export?module=${encodeURIComponent(config.slug)}`}
        manageFieldsHref={
          session.isSuperadmin && session.tenantId
            ? `/superadmin/tenants/${session.tenantId}/modules/${config.slug}/fields`
            : undefined
        }
      />
    </div>
  )
}
