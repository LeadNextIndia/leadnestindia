import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — bulk reorder modules for one tenant.
// Body: { tenant_id: string, ids: string[] } — the ids array is the desired
// order (index 0 → sort_order 0, and so on). Superadmin-only.
export async function POST(req: NextRequest) {
  await requireSuperadmin()

  let body: { tenant_id?: string; ids?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const tenantId = (body.tenant_id ?? '').trim()
  const ids = body.ids
  if (!tenantId) return Response.json({ error: 'tenant_id is required.' }, { status: 400 })
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'ids must be a non-empty array.' }, { status: 400 })
  }
  if (ids.length > 100) {
    return Response.json({ error: 'Too many modules (max 100).' }, { status: 400 })
  }
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id !== 'string' || seen.has(id)) {
      return Response.json({ error: 'Duplicate or invalid id.' }, { status: 400 })
    }
    seen.add(id)
  }

  const admin = createAdminClient()

  // Verify every id belongs to this tenant (defense in depth).
  const { data: existing } = await admin
    .from('lead_modules')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', ids)
  const validIds = new Set(((existing ?? []) as Array<{ id: string }>).map((r) => r.id))
  for (const id of ids) {
    if (!validIds.has(id)) {
      return Response.json({ error: `Unknown module: ${id}` }, { status: 400 })
    }
  }

  // Apply new sort_order sequentially. Postgres has no batch update-by-VALUES
  // through the JS client, so we issue N updates. N ≤ 100 by validation above.
  for (let i = 0; i < ids.length; i += 1) {
    const { error } = await admin
      .from('lead_modules')
      .update({ sort_order: i })
      .eq('id', ids[i])
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, count: ids.length })
}
