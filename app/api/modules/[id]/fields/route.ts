import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

// GET — resolved field list for this module. Superadmin-only.
// Returns every field_definitions row for the tenant, joined with the
// module_fields override if one exists. Callers use `included=true` to
// decide "in the module" vs "available to add".
export async function GET(_req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()

  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data: moduleRow } = await admin
    .from('lead_modules')
    .select('tenant_id')
    .eq('id', id)
    .maybeSingle()
  if (!moduleRow) return Response.json({ error: 'Module not found.' }, { status: 404 })

  const [{ data: catalogRaw }, { data: mfRaw }] = await Promise.all([
    admin
      .from('field_definitions')
      .select('id,key,label,type,required,options,sort_order,active')
      .eq('tenant_id', moduleRow.tenant_id)
      .order('sort_order')
      .order('created_at'),
    admin
      .from('module_fields')
      .select('field_id,label_override,required_override,sort_order,visible')
      .eq('module_id', id),
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

  const fields = ((catalogRaw ?? []) as Array<{
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
      field_id: f.id,
      key: f.key,
      catalog_label: f.label,
      type: f.type,
      catalog_required: !!f.required,
      options: f.options ?? null,
      included: !!mf,
      label_override: mf?.label_override ?? null,
      required_override: mf?.required_override ?? null,
      visible: mf ? mf.visible !== false : false,
      sort_order: mf?.sort_order ?? f.sort_order ?? 0,
      effective_label: mf?.label_override ?? f.label,
      effective_required: mf?.required_override ?? !!f.required,
    }
  })

  return Response.json({ fields })
}

// PUT — replace this module's field set. Superadmin-only.
// Body: { fields: Array<{ field_id, label_override?, required_override?, visible?, sort_order? }> }
// Any field_id not in the array is REMOVED from the module.
export async function PUT(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()

  const { id } = await ctx.params

  let body: {
    fields?: Array<{
      field_id: string
      label_override?: string | null
      required_override?: boolean | null
      visible?: boolean
      sort_order?: number
    }>
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const rows = body.fields ?? []
  if (!Array.isArray(rows)) {
    return Response.json({ error: 'fields must be an array.' }, { status: 400 })
  }
  if (rows.length > 200) {
    return Response.json({ error: 'Too many fields (max 200).' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: moduleRow } = await admin
    .from('lead_modules')
    .select('tenant_id')
    .eq('id', id)
    .maybeSingle()
  if (!moduleRow) return Response.json({ error: 'Module not found.' }, { status: 404 })

  // Verify every field_id belongs to the same tenant.
  const ids = rows.map((r) => r.field_id)
  if (ids.length > 0) {
    const { data: valid } = await admin
      .from('field_definitions')
      .select('id')
      .eq('tenant_id', moduleRow.tenant_id)
      .in('id', ids)
    const validIds = new Set(((valid ?? []) as Array<{ id: string }>).map((r) => r.id))
    for (const rid of ids) {
      if (!validIds.has(rid)) {
        return Response.json({ error: `Unknown field: ${rid}` }, { status: 400 })
      }
    }
  }

  // Wipe and re-insert. Simpler than diffing and correct for small N.
  const del = await admin.from('module_fields').delete().eq('module_id', id)
  if (del.error) return Response.json({ error: del.error.message }, { status: 500 })

  if (rows.length > 0) {
    const ins = await admin.from('module_fields').insert(
      rows.map((r, i) => ({
        module_id: id,
        field_id: r.field_id,
        label_override: r.label_override ?? null,
        required_override: r.required_override ?? null,
        visible: r.visible !== false,
        sort_order: r.sort_order ?? i,
      })),
    )
    if (ins.error) return Response.json({ error: ins.error.message }, { status: 500 })
  }

  return Response.json({ ok: true, count: rows.length })
}
