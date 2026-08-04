import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

const ALLOWED_COLORS = new Set([
  'gray', 'blue', 'indigo', 'amber', 'green', 'red', 'purple', 'pink', 'teal',
])

const KEY_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/

// GET — list statuses for a module. Superadmin-only for symmetry with PUT.
export async function GET(_req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('module_statuses')
    .select('id,key,label,color,sort_order,is_default,is_terminal')
    .eq('module_id', id)
    .order('sort_order')
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ statuses: data ?? [] })
}

// PUT — replace this module's status set.
// Body: { statuses: Array<{ key, label, color, sort_order?, is_default?, is_terminal? }> }
// Existing rows are wiped and re-inserted (small N, simpler than diffing).
// NOTE: existing `leads.status` values that reference removed keys are NOT
// automatically renamed — the app renders the raw key with a gray fallback
// badge. Callers should reassign before removing a status. Better UX for
// that comes in a follow-up.
export async function PUT(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { id } = await ctx.params

  let body: {
    statuses?: Array<{
      key: string
      label: string
      color?: string
      sort_order?: number
      is_default?: boolean
      is_terminal?: boolean
    }>
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const rows = body.statuses ?? []
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'At least one status is required.' }, { status: 400 })
  }
  if (rows.length > 50) {
    return Response.json({ error: 'Too many statuses (max 50).' }, { status: 400 })
  }

  const seenKeys = new Set<string>()
  let defaultCount = 0
  for (const r of rows) {
    const key = (r.key ?? '').trim()
    const label = (r.label ?? '').trim()
    if (!KEY_PATTERN.test(key)) {
      return Response.json({ error: `Invalid key "${key}". Use lowercase letters, digits, underscores.` }, { status: 400 })
    }
    if (seenKeys.has(key)) {
      return Response.json({ error: `Duplicate key "${key}".` }, { status: 400 })
    }
    seenKeys.add(key)
    if (!label || label.length > 60) {
      return Response.json({ error: 'Every status needs a label (max 60 chars).' }, { status: 400 })
    }
    if (r.color && !ALLOWED_COLORS.has(r.color)) {
      return Response.json({ error: `Invalid color "${r.color}".` }, { status: 400 })
    }
    if (r.is_default) defaultCount += 1
  }
  if (defaultCount !== 1) {
    return Response.json({ error: 'Exactly one status must be marked as default.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: moduleRow } = await admin
    .from('lead_modules')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!moduleRow) return Response.json({ error: 'Module not found.' }, { status: 404 })

  // Wipe + re-insert. We need to satisfy the "one default per module" partial
  // unique index during the update — clearing all rows first sidesteps that.
  const del = await admin.from('module_statuses').delete().eq('module_id', id)
  if (del.error) return Response.json({ error: del.error.message }, { status: 500 })

  const ins = await admin.from('module_statuses').insert(
    rows.map((r, i) => ({
      module_id: id,
      key: r.key.trim(),
      label: r.label.trim(),
      color: r.color ?? 'gray',
      sort_order: r.sort_order ?? i,
      is_default: !!r.is_default,
      is_terminal: !!r.is_terminal,
    })),
  )
  if (ins.error) return Response.json({ error: ins.error.message }, { status: 500 })

  return Response.json({ ok: true, count: rows.length })
}
