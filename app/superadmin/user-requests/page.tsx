import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { UserRequestsClient } from '@/components/user-requests-client'

export const dynamic = 'force-dynamic'

type RequestRow = {
  id: string
  tenant_id: string
  requested_by: string | null
  name: string
  email: string
  mobile: string | null
  requested_role: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected'
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export default async function UserRequestsPage() {
  await requireSuperadmin()

  const admin = createAdminClient()
  const [{ data: reqRaw }, { data: tenantsRaw }, { data: usersRaw }] = await Promise.all([
    admin
      .from('user_creation_requests')
      .select('id, tenant_id, requested_by, name, email, mobile, requested_role, status, review_notes, created_at, reviewed_at')
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

  const requests = ((reqRaw ?? []) as RequestRow[]).map((r) => ({
    ...r,
    tenantName: tenants.get(r.tenant_id) ?? r.tenant_id.slice(0, 8),
    requesterEmail: r.requested_by ? usersEmail.get(r.requested_by) ?? null : null,
  }))

  const stats = {
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">User creation requests</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Company admins request new users; you approve or reject.
        </p>
      </div>

      <div className="flex gap-3">
        <StatChip label="Pending" value={stats.pending} tone="amber" />
        <StatChip label="Approved" value={stats.approved} tone="emerald" />
        <StatChip label="Rejected" value={stats.rejected} tone="rose" />
      </div>

      <UserRequestsClient requests={requests} />
    </div>
  )
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'emerald' | 'rose' }) {
  const toneMap = {
    amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30',
    rose: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-500/30',
  }
  return (
    <div className={`px-3 py-1.5 rounded-md border text-xs font-medium ${toneMap[tone]}`}>
      {label} · <strong>{value}</strong>
    </div>
  )
}
