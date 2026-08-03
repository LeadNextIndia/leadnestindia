import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { withDefaults, type Features } from '@/lib/features'

const MAX_LABEL_LEN = 80
// Label sanitizer — strip anything that looks like HTML or a script.
// The label is rendered directly in tables and forms, so we must prevent XSS.
const DANGEROUS_CHARS = /[<>]/g

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  }

  const { id: fieldId } = await ctx.params
  if (!fieldId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = (body as { label?: unknown }).label
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'label must be a string' }, { status: 400 })
  }
  const label = raw.replace(DANGEROUS_CHARS, '').trim()
  if (!label) {
    return NextResponse.json({ error: 'Label required' }, { status: 400 })
  }
  if (label.length > MAX_LABEL_LEN) {
    return NextResponse.json({ error: `Label too long (max ${MAX_LABEL_LEN} chars)` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Server-side re-check of the feature flag — never trust that the client's
  // sidebar visibility means the tenant actually has this feature on.
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('features')
    .eq('id', session.tenantId)
    .maybeSingle()
  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features
  )
  if (!session.isSuperadmin && !features.field_labels) {
    return NextResponse.json({ error: 'Feature not enabled for your account' }, { status: 403 })
  }

  // Verify the field belongs to the caller's tenant — this prevents an admin of
  // tenant A from renaming a field on tenant B by supplying a foreign fieldId.
  const { data: existing } = await admin
    .from('field_definitions')
    .select('id, tenant_id, label')
    .eq('id', fieldId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('field_definitions')
    .update({ label })
    .eq('id', fieldId)
    .eq('tenant_id', session.tenantId)
    .select('id, key, label, type, required, options, active, sort_order')
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'field_labels.rename',
    target_type: 'field_definitions',
    target_id: fieldId,
    metadata: { from_label: existing.label, to_label: label },
  })

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  }

  const { id: fieldId } = await ctx.params
  if (!fieldId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()

  // Feature-flag re-check
  const { data: tenantRow } = await admin
    .from('tenants').select('features').eq('id', session.tenantId).maybeSingle()
  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features
  )
  if (!session.isSuperadmin && !features.field_labels) {
    return NextResponse.json({ error: 'Feature not enabled for your account' }, { status: 403 })
  }

  // Verify the field belongs to the caller's tenant before deleting.
  const { data: existing } = await admin
    .from('field_definitions')
    .select('id, tenant_id, label, key')
    .eq('id', fieldId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('field_definitions')
    .delete()
    .eq('id', fieldId)
    .eq('tenant_id', session.tenantId)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'field_labels.delete',
    target_type: 'field_definitions',
    target_id: fieldId,
    metadata: { key: existing.key, label: existing.label },
  })

  return NextResponse.json({ ok: true })
}
