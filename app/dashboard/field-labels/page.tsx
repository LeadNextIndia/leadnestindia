import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { withDefaults, type Features } from '@/lib/features'
import { FieldLabelsEditor, type EditableField } from '@/components/field-labels-editor'
import { FieldsIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function FieldLabelsPage() {
  const session = await requireAdmin()
  if (!session.tenantId) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: tenantRow }, { data: fieldsRaw }] = await Promise.all([
    supabase.from('tenants').select('features').eq('id', session.tenantId).maybeSingle(),
    supabase
      .from('field_definitions')
      .select('id, key, label, type')
      .eq('tenant_id', session.tenantId)
      .order('sort_order')
      .order('created_at'),
  ])

  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features
  )

  // Server-side feature-flag re-check — never trust the sidebar's visibility alone.
  if (!session.isSuperadmin && !features.field_labels) {
    redirect('/dashboard')
  }

  const fields: EditableField[] = (fieldsRaw ?? []).map((f) => ({
    id: f.id as string,
    key: f.key as string,
    label: f.label as string,
    type: f.type as string,
  }))

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FieldsIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Field labels
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Rename how each field appears in your Leads table and new-lead form.
          The internal key stays the same, so existing lead data is not affected.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-6">
        <FieldLabelsEditor initialFields={fields} />
      </section>
    </div>
  )
}
