import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { ArrowLeftIcon } from '@/components/icons'
import { ModuleFieldsEditor, type EditorField } from '@/components/module-fields-editor'

type Props = { params: Promise<{ tenantId: string; slug: string }> }

export const dynamic = 'force-dynamic'

export default async function SuperadminModuleFieldsPage({ params }: Props) {
  await requireSuperadmin()
  const { tenantId, slug } = await params

  const admin = createAdminClient()
  const { data: moduleRow } = await admin
    .from('lead_modules')
    .select('id,slug,singular,plural,is_default')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .maybeSingle()

  if (!moduleRow) notFound()

  const [{ data: catalogRaw }, { data: mfRaw }] = await Promise.all([
    admin
      .from('field_definitions')
      .select('id,key,label,type,required,options,sort_order,active')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('created_at'),
    admin
      .from('module_fields')
      .select('field_id,label_override,required_override,sort_order,visible')
      .eq('module_id', moduleRow.id),
  ])

  const mfByField = new Map<string, {
    label_override: string | null
    required_override: boolean | null
    sort_order: number | null
    visible: boolean | null
  }>()
  for (const row of (mfRaw ?? []) as Array<{
    field_id: string
    label_override: string | null
    required_override: boolean | null
    sort_order: number | null
    visible: boolean | null
  }>) {
    mfByField.set(row.field_id, row)
  }

  const fields: EditorField[] = ((catalogRaw ?? []) as Array<{
    id: string
    key: string
    label: string
    type: string
    required: boolean | null
    options: string[] | null
    sort_order: number | null
    active: boolean | null
  }>).map((f) => {
    const mf = mfByField.get(f.id)
    return {
      fieldId: f.id,
      key: f.key,
      catalogLabel: f.label,
      type: f.type,
      catalogRequired: !!f.required,
      included: !!mf,
      labelOverride: mf?.label_override ?? '',
      requiredOverride: mf?.required_override ?? null,
      sortOrder: mf?.sort_order ?? f.sort_order ?? 0,
    }
  })

  fields.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1
    return a.sortOrder - b.sortOrder
  })

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
          Fields · {moduleRow.plural}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pick which catalog fields appear in this module and override their labels.
        </p>
      </div>

      <ModuleFieldsEditor moduleId={moduleRow.id} initialFields={fields} />
    </div>
  )
}
