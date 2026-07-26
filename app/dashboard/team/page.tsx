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
        <h1 className="text-xl font-semibold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-1">
          You&apos;re a superadmin without a tenant. Manage tenants on the{' '}
          <a href="/superadmin" className="text-blue-600 hover:underline">Superadmin</a> page.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: membersRaw } = await supabase
    .from('tenant_users')
    .select('user_id, email, role, created_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at')

  const members = (membersRaw ?? []).map((m) => ({
    userId: m.user_id as string,
    email: (m.email ?? '—') as string,
    role: (m.role ?? 'user') as 'admin' | 'user',
    createdAt: m.created_at as string,
  }))

  return (
    <TeamPageClient
      members={members}
      currentUserId={session.user.id}
    />
  )
}
