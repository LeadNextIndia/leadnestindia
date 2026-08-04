import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/authz'
import type { SavedView } from '@/components/saved-views-menu'
import type { LeadFilter } from '@/lib/filters'
import type { Member } from '@/components/lead-edit-modal'
import { type Features, withDefaults } from '@/lib/features'
import { getModuleConfig } from '@/lib/lead-modules'
import { LeadBoard } from '@/components/lead-board'
import { NewLeadButton } from '@/components/new-lead-button'

type Lead = {
  id: string
  created_at: string
  status: string | null
  custom_data: Record<string, unknown> | null
  assigned_to: string | null
  follow_up_at: string | null
}

type Props = { params: Promise<{ slug: string }> }

export default async function ModuleBoardPage({ params }: Props) {
  const { slug } = await params
  const [session, supabase] = await Promise.all([getSession(), createClient()])
  if (!session?.tenantId) notFound()

  const config = await getModuleConfig(supabase, session.tenantId, slug)
  if (!config) notFound()

  // Feature gate — kanban is paid. Superadmins bypass.
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('features')
    .eq('id', session.tenantId)
    .maybeSingle()
  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features,
  )
  if (!session.isSuperadmin && !features.kanban) {
    redirect(`/dashboard/m/${config.slug}`)
  }

  const canEdit = !!(session.isSuperadmin || session.role === 'admin')

  const [{ data: leadsRaw }, { data: savedViewsRaw }, { data: membersRaw }] = await Promise.all([
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
    supabase.from('tenant_users').select('user_id,email').eq('tenant_id', session.tenantId),
  ])

  const leads: Lead[] = (leadsRaw ?? []) as Lead[]
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

  const analyticsEnabled = !!session.isSuperadmin || features.analytics
  const invoicingEnabled = !!session.isSuperadmin || features.invoicing
  const activityEnabled = !!session.isSuperadmin || features.activity

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {config.plural} <span className="text-gray-400 dark:text-gray-500 font-normal">· Board</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Drag cards between columns to change status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-gray-200/70 dark:border-[var(--border)] bg-white/60 dark:bg-[var(--surface)]/70 backdrop-blur-sm p-1">
            <Link
              href={`/dashboard/m/${config.slug}`}
              className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-[var(--surface-muted)] transition-colors"
            >
              Table
            </Link>
            <span className="px-3 py-1 text-xs font-medium brand-gradient text-white rounded-full shadow-sm shadow-indigo-500/30">
              Board
            </span>
          </div>
          <NewLeadButton moduleSlug={config.slug} moduleSingular={config.singular} />
        </div>
      </div>

      {config.statuses.length === 0 ? (
        <div className="rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          This module has no statuses defined yet. A superadmin needs to add statuses before the
          board can render.
        </div>
      ) : (
        <LeadBoard
          leads={leads}
          fieldDefs={fieldDefs}
          statuses={config.statuses}
          members={members}
          currentUserId={session.user.id}
          savedViews={savedViews}
          showAnalytics={analyticsEnabled}
          showInvoicing={invoicingEnabled}
          showActivity={activityEnabled}
          canEdit={canEdit}
          moduleSingular={config.singular}
        />
      )}
    </div>
  )
}
