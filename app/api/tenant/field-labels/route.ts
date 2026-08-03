import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { withDefaults, type Features } from '@/lib/features'

const VALID_TYPES = ['text', 'number', 'email', 'tel', 'date', 'select', 'textarea'] as const
const MAX_LABEL_LEN = 80
const MAX_KEY_LEN = 60
const MAX_OPTIONS = 40
const MAX_OPTION_LEN = 60
const DANGEROUS_CHARS = /[<>]/g

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_KEY_LEN)
  return base || `field_${Date.now().toString(36)}`
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = body as {
    label?: unknown
    type?: unknown
    required?: unknown
    options?: unknown
  }

  const rawLabel = typeof b.label === 'string' ? b.label.replace(DANGEROUS_CHARS, '').trim() : ''
  if (!rawLabel || rawLabel.length > MAX_LABEL_LEN) {
    return NextResponse.json({ error: `Label required (max ${MAX_LABEL_LEN} chars)` }, { status: 400 })
  }

  const type = typeof b.type === 'string' ? b.type : ''
  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const required = !!b.required

  let options: string[] | null = null
  if (type === 'select') {
    if (!Array.isArray(b.options)) {
      return NextResponse.json({ error: 'options required for select type' }, { status: 400 })
    }
    if (b.options.length === 0 || b.options.length > MAX_OPTIONS) {
      return NextResponse.json({ error: `1–${MAX_OPTIONS} options required` }, { status: 400 })
    }
    const validated: string[] = []
    for (const o of b.options) {
      if (typeof o !== 'string') {
        return NextResponse.json({ error: 'options must be strings' }, { status: 400 })
      }
      const clean = o.replace(DANGEROUS_CHARS, '').trim()
      if (!clean || clean.length > MAX_OPTION_LEN) {
        return NextResponse.json({ error: `Each option must be 1–${MAX_OPTION_LEN} chars` }, { status: 400 })
      }
      validated.push(clean)
    }
    options = validated
  }

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

  // Generate a unique key: slugify label, dedupe on collision.
  const baseKey = slugify(rawLabel)
  let key = baseKey
  for (let i = 2; i < 30; i++) {
    const { data: exists } = await admin
      .from('field_definitions')
      .select('id')
      .eq('tenant_id', session.tenantId)
      .eq('key', key)
      .maybeSingle()
    if (!exists) break
    key = `${baseKey}_${i}`.slice(0, MAX_KEY_LEN)
  }

  // sort_order = current max + 1
  const { data: last } = await admin
    .from('field_definitions')
    .select('sort_order')
    .eq('tenant_id', session.tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number) ?? -1) + 1

  const { data, error } = await admin
    .from('field_definitions')
    .insert({
      tenant_id: session.tenantId,
      key,
      label: rawLabel,
      type,
      required,
      options,
      sort_order,
      active: true,
    })
    .select('id, key, label, type, required, options, active, sort_order')
    .single()

  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'field_labels.add',
    target_type: 'field_definitions',
    target_id: data.id,
    metadata: { key, label: rawLabel, type },
  })

  return NextResponse.json(data, { status: 201 })
}
