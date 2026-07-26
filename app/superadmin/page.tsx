import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperadmin } from '@/lib/authz'
import { SuperadminPageClient } from '@/components/superadmin-page-client'

export const dynamic = 'force-dynamic'

type TenantRow = {
  id: string
  name: string
  createdAt: string
  memberCount: number
  adminCount: number
}

export default async function SuperadminPage() {
  await requireSuperadmin()

  // Use admin client to see everything, bypassing RLS
  const admin = createAdminClient()

  const [{ data: tenants }, { data: memberships }] = await Promise.all([
    admin.from('tenants').select('id, name, created_at').order('created_at', { ascending: false }),
    admin.from('tenant_users').select('tenant_id, role'),
  ])

  const memberCountByTenant = new Map<string, { total: number; admin: number }>()
  for (const m of memberships ?? []) {
    const key = m.tenant_id as string
    const bucket = memberCountByTenant.get(key) ?? { total: 0, admin: 0 }
    bucket.total += 1
    if (m.role === 'admin') bucket.admin += 1
    memberCountByTenant.set(key, bucket)
  }

  const rows: TenantRow[] = (tenants ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    createdAt: t.created_at as string,
    memberCount: memberCountByTenant.get(t.id as string)?.total ?? 0,
    adminCount: memberCountByTenant.get(t.id as string)?.admin ?? 0,
  }))

  return <SuperadminPageClient tenants={rows} />
}
