import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { TenantConfigClient } from '@/components/tenant-config-client'
import { type Features, withDefaults } from '@/lib/features'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ tenantId: string }> }

type TenantUserRow = {
  user_id: string
  email: string | null
  role: 'admin' | 'user'
  created_at: string
}

export default async function TenantConfigPage({ params }: Props) {
  await requireSuperadmin()
  const { tenantId } = await params

  const admin = createAdminClient()

  // 1. Existence check — plain columns only, so a missing "features" column
  //    still lets us render the page with a schema warning instead of 404.
  const { data: tenantBase, error: tenantErr } = await admin
    .from('tenants')
    .select('id,name,created_at')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantErr) {
    return (
      <SchemaError title="Failed to load tenant" detail={tenantErr.message} />
    )
  }
  if (!tenantBase) notFound()

  // 2. Fetch schema-dependent bits separately so we can degrade gracefully.
  const [featuresRes, fieldsRes, usersRes, leadCountRes] = await Promise.all([
    admin.from('tenants').select('features').eq('id', tenantId).maybeSingle(),
    admin
      .from('field_definitions')
      .select('id,key,label,type,required,options,active,sort_order')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('created_at'),
    admin
      .from('tenant_users')
      .select('user_id,email,role,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ])

  const schemaIssues: string[] = []
  if (featuresRes.error) {
    schemaIssues.push(`tenants.features → ${featuresRes.error.message}`)
  }
  if (fieldsRes.error) {
    schemaIssues.push(`field_definitions → ${fieldsRes.error.message}`)
  }
  if (usersRes.error) {
    schemaIssues.push(`tenant_users → ${usersRes.error.message}`)
  }
  const schemaReady = schemaIssues.length === 0
  const features: Features = withDefaults(featuresRes.data?.features as Partial<Features> | null)
  const users = (usersRes.data ?? []) as TenantUserRow[]
  const adminCount = users.filter((u) => u.role === 'admin').length
  const leadCount = leadCountRes.count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/superadmin"
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-[var(--border)] rounded px-2 py-1"
        >
          ← All tenants
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{tenantBase.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tenant ID: {tenantId}</p>
        </div>
      </div>

      {/* Overview strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Members" value={users.length} />
        <StatCard label="Admins" value={adminCount} />
        <StatCard label="Leads" value={leadCount} />
        <StatCard
          label="Onboarded"
          value={new Date(tenantBase.created_at).toLocaleDateString('en-GB')}
        />
      </div>

      {!schemaReady && (
        <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md px-3 py-2 space-y-1">
          <div>
            <strong>Schema not ready.</strong> These queries failed — run <code className="font-mono">db/phase3.sql</code> in the Supabase SQL editor:
          </div>
          <ul className="list-disc pl-5 font-mono text-xs">
            {schemaIssues.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <TenantConfigClient
        tenantId={tenantId}
        initialFields={fieldsRes.data ?? []}
        initialFeatures={features}
        initialUsers={users}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{value}</div>
    </div>
  )
}

function SchemaError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-2xl mx-auto rounded-lg border border-red-200 bg-red-50 p-5">
      <h1 className="text-base font-semibold text-red-800">{title}</h1>
      <p className="text-sm text-red-700 mt-2">{detail}</p>
      <p className="text-xs text-red-600 mt-3">
        If this looks like a missing column or table, run <code className="font-mono">db/phase3.sql</code> in Supabase.
      </p>
    </div>
  )
}
