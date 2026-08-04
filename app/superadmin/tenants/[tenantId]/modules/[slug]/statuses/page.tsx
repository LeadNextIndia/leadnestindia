import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { ArrowLeftIcon } from '@/components/icons'
import { ModuleStatusesEditor } from '@/components/module-statuses-editor'
import { listModuleStatuses } from '@/lib/lead-modules'

type Props = { params: Promise<{ tenantId: string; slug: string }> }

export const dynamic = 'force-dynamic'

export default async function SuperadminModuleStatusesPage({ params }: Props) {
  await requireSuperadmin()
  const { tenantId, slug } = await params

  const admin = createAdminClient()
  const { data: moduleRow } = await admin
    .from('lead_modules')
    .select('id,slug,singular,plural')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .maybeSingle()

  if (!moduleRow) notFound()

  const statuses = await listModuleStatuses(admin, moduleRow.id)

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/superadmin/tenants/${tenantId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to tenant
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Statuses · {moduleRow.plural}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Define the workflow states records in this module can be in. Reorder to change
          pipeline sequence.
        </p>
      </div>

      <ModuleStatusesEditor moduleId={moduleRow.id} initialStatuses={statuses} />
    </div>
  )
}
