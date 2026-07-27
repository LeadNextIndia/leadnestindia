import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { SupportTicketsClient } from '@/components/support-tickets-client'

export const dynamic = 'force-dynamic'

type TicketRow = {
  id: string
  tenant_id: string
  created_by: string | null
  subject: string
  body: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  resolution: string | null
  created_at: string
  resolved_at: string | null
}

export default async function SupportInboxPage() {
  await requireSuperadmin()

  const admin = createAdminClient()
  const [{ data: ticketsRaw }, { data: tenantsRaw }, { data: usersRaw }] = await Promise.all([
    admin
      .from('support_tickets')
      .select('id, tenant_id, created_by, subject, body, priority, status, resolution, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('tenants').select('id, name, display_name'),
    admin.from('tenant_users').select('user_id, email'),
  ])

  const tenants = new Map(
    ((tenantsRaw ?? []) as Array<{ id: string; name: string; display_name: string | null }>).map(
      (t) => [t.id, t.display_name || t.name]
    )
  )
  const usersEmail = new Map(
    ((usersRaw ?? []) as Array<{ user_id: string; email: string | null }>).map((u) => [u.user_id, u.email])
  )

  const tickets = ((ticketsRaw ?? []) as TicketRow[]).map((t) => ({
    ...t,
    tenantName: tenants.get(t.tenant_id) ?? t.tenant_id.slice(0, 8),
    creatorEmail: t.created_by ? usersEmail.get(t.created_by) ?? null : null,
  }))

  const stats = {
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Support inbox</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Tickets raised by tenant admins from their Settings page.
        </p>
      </div>

      <div className="flex gap-3">
        <StatChip label="Open" value={stats.open} tone="blue" />
        <StatChip label="In progress" value={stats.in_progress} tone="amber" />
        <StatChip label="Resolved" value={stats.resolved} tone="emerald" />
      </div>

      <SupportTicketsClient tickets={tickets} />
    </div>
  )
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'emerald' }) {
  const toneMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-500/30',
    amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30',
  }
  return (
    <div className={`px-3 py-1.5 rounded-md border text-xs font-medium ${toneMap[tone]}`}>
      {label} · <strong>{value}</strong>
    </div>
  )
}
