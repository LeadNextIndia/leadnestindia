import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
const MAX_RESOLUTION = 5000

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireSuperadmin()
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as { status?: unknown; resolution?: unknown }
  const status = typeof b.status === 'string' ? b.status : null
  const resolution = typeof b.resolution === 'string' ? b.resolution.trim() : null

  if (!status || !STATUSES.includes(status as typeof STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (resolution && resolution.length > MAX_RESOLUTION) {
    return NextResponse.json({ error: 'Resolution too long' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load the ticket first so we can (a) confirm it exists, (b) capture its tenant
  // for the audit log. Returning early on missing avoids a silent no-op update.
  const { data: existing, error: loadErr } = await admin
    .from('support_tickets')
    .select('id, tenant_id, status')
    .eq('id', id)
    .maybeSingle()

  if (loadErr) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'resolved' || status === 'closed') {
    updates.resolved_at = new Date().toISOString()
    updates.resolved_by = session.user.id
    if (resolution) updates.resolution = resolution
  }

  const { data, error } = await admin
    .from('support_tickets')
    .update(updates)
    .eq('id', id)
    .select('id, status, resolved_at, resolution')
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: existing.tenant_id,
    action: 'support_ticket.status_change',
    target_type: 'support_tickets',
    target_id: id,
    metadata: { from_status: existing.status, to_status: status, resolution: resolution ?? null },
  })

  return NextResponse.json(data)
}
