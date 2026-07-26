import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/authz'
import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'
import { LeadsTable } from '@/components/leads-table'
import type { SavedView } from '@/components/saved-views-menu'
import type { Member } from '@/components/lead-edit-modal'
import type { LeadFilter } from '@/lib/filters'
import { type Features, withDefaults } from '@/lib/features'
import { PlusIcon } from '@/components/icons'

type Lead = {
  id: string
  created_at: string
  status: string | null
  custom_data: Record<string, unknown> | null
  assigned_to: string | null
  follow_up_at: string | null
}

type FieldDef = {
  key: string
  label: string
  type: string
  required: boolean
  options: string[] | null
}

function getWeekAgoMs() {
  return Date.now() - 7 * 24 * 60 * 60 * 1000
}

function startOfDayMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export default async function LeadsPage() {
  const [session, supabase] = await Promise.all([getSession(), createClient()])

  const canEdit = !!(session?.isSuperadmin || session?.role === 'admin')

  const [
    { data: leadsRaw },
    { data: fieldDefsRaw },
    { data: savedViewsRaw },
    { data: tenantRow },
    { data: membersRaw },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id,created_at,status,custom_data,assigned_to,follow_up_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('field_definitions')
      .select('key,label,type,required,options')
      .eq('active', true)
      .order('sort_order')
      .order('created_at'),
    session && !session.isSuperadmin && session.tenantId
      ? supabase
          .from('saved_views')
          .select('id,name,filter,created_at')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    session?.tenantId
      ? supabase.from('tenants').select('features').eq('id', session.tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    session?.tenantId
      ? supabase
          .from('tenant_users')
          .select('user_id,email')
          .eq('tenant_id', session.tenantId)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features,
  )
  const analyticsEnabled = !!session?.isSuperadmin || features.analytics
  const exportEnabled = !!session?.isSuperadmin || features.export
  const invoicingEnabled = !!session?.isSuperadmin || features.invoicing
  const activityEnabled = !!session?.isSuperadmin || features.activity

  const leads: Lead[] = (leadsRaw ?? []) as Lead[]
  const fieldDefs: FieldDef[] = (fieldDefsRaw ?? []).map((f) => ({
    key: f.key as string,
    label: f.label as string,
    type: f.type as string,
    required: !!f.required,
    options: (f.options as string[] | null) ?? null,
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

  const total = leads.length
  const byStatus = (name: string) =>
    leads.filter((l) => (l.status ?? 'new').toLowerCase() === name).length

  const newCount  = byStatus('new')
  const wonCount  = byStatus('won')
  const lostCount = byStatus('lost')

  const weekAgo  = getWeekAgoMs()
  const thisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length

  // Follow-up counts for the signed-in user
  const currentUserId = session?.user.id ?? null
  const today = startOfDayMs()
  const tomorrow = today + 24 * 3600 * 1000
  const myFollowUps = currentUserId
    ? leads.filter((l) => l.assigned_to === currentUserId && l.follow_up_at)
    : []
  const dueToday = myFollowUps.filter((l) => {
    const t = new Date(l.follow_up_at!).getTime()
    return t >= today && t < tomorrow
  }).length
  const overdue = myFollowUps.filter((l) => new Date(l.follow_up_at!).getTime() < today).length

  const columns = fieldDefs.length > 0
    ? fieldDefs.map((f) => f.key)
    : Array.from(new Set(leads.flatMap((l) => Object.keys(l.custom_data ?? {}))))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All customer inquiries for your store.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/new"
            className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 transition">
            <PlusIcon className="w-4 h-4" /> New Lead
          </Link>
        </div>
      </div>

      {currentUserId && (overdue > 0 || dueToday > 0) && (
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
        <KpiCard label="Total"     value={total}     accent="gray"  />
        <KpiCard label="This week" value={thisWeek}  accent="blue"  hint="Last 7 days" />
        <KpiCard label="New"       value={newCount}  accent="blue"  />
        <KpiCard label="Won"       value={wonCount}  accent="green" />
        <KpiCard label="Lost"      value={lostCount} accent="red"   />
      </div>

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
      />
    </div>
  )
}
