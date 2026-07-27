import { requireAdmin } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { TeamPageClient } from '@/components/team-page-client'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const session = await requireAdmin()

  // Superadmins without a tenant land on /superadmin instead
  if (!session.tenantId) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Team</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          You&apos;re a superadmin without a tenant. Manage tenants on the{' '}
          <a href="/superadmin" className="text-blue-600 hover:underline">Superadmin</a> page.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  const [{ data: membersRaw }, { data: requestsRaw }] = await Promise.all([
    supabase
      .from('tenant_users')
      .select('user_id, email, role, created_at')
      .eq('tenant_id', session.tenantId)
      .order('created_at'),
    supabase
      .from('user_creation_requests')
      .select('id, name, email, mobile, requested_role, status, review_notes, created_at, reviewed_at')
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const members = (membersRaw ?? []).map((m) => ({
    userId: m.user_id as string,
    email: (m.email ?? '—') as string,
    role: (m.role ?? 'user') as 'admin' | 'user',
    createdAt: m.created_at as string,
  }))

  const requests = (requestsRaw ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    mobile: (r.mobile as string | null) ?? null,
    requestedRole: r.requested_role as 'admin' | 'user',
    status: r.status as 'pending' | 'approved' | 'rejected',
    reviewNotes: (r.review_notes as string | null) ?? null,
    createdAt: r.created_at as string,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
  }))

  return (
    <TeamPageClient
      members={members}
      currentUserId={session.user.id}
      requests={requests}
    />
  )
}
