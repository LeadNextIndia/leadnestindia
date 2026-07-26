import { NextRequest } from 'next/server'
import { requireAdmin, requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = RouteContext<'/api/leads/[id]'>

const SELECT_COLS = 'id,tenant_id,status,custom_data,created_at,assigned_to,follow_up_at' as const

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin()
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const updates: Record<string, unknown> = {}
  if (body.status !== undefined)       updates.status       = body.status
  if (body.custom_data !== undefined)  updates.custom_data  = body.custom_data
  if (body.assigned_to !== undefined)  updates.assigned_to  = body.assigned_to || null
  if (body.follow_up_at !== undefined) updates.follow_up_at = body.follow_up_at || null

  if (Object.keys(updates).length === 0)
    return Response.json({ error: 'Nothing to update.' }, { status: 400 })

  const admin = createAdminClient()

  // Load existing so we can detect what changed (for activity log + tenant check)
  const { data: before, error: readErr } = await admin
    .from('leads')
    .select(SELECT_COLS)
    .eq('id', id)
    .maybeSingle()

  if (readErr) return Response.json({ error: readErr.message }, { status: 500 })
  if (!before) return Response.json({ error: 'Lead not found.' }, { status: 404 })

  if (!session.isSuperadmin && before.tenant_id !== session.tenantId)
    return Response.json({ error: 'Lead not found.' }, { status: 404 })

  const { data: after, error } = await admin
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Log auto-events (best-effort, never fail the request on log write)
  const events: Array<{ kind: string; body?: string | null; metadata?: Record<string, unknown> }> = []
  if (updates.status !== undefined && before.status !== after.status) {
    events.push({
      kind: 'status_change',
      metadata: { from: before.status, to: after.status },
    })
  }
  if (updates.assigned_to !== undefined && before.assigned_to !== after.assigned_to) {
    events.push({
      kind: 'assigned',
      metadata: { from: before.assigned_to, to: after.assigned_to },
    })
  }
  if (updates.follow_up_at !== undefined && before.follow_up_at !== after.follow_up_at) {
    events.push({
      kind: 'follow_up_set',
      metadata: { from: before.follow_up_at, to: after.follow_up_at },
    })
  }
  if (updates.custom_data !== undefined) {
    events.push({ kind: 'edited' })
  }

  if (events.length > 0) {
    await admin.from('lead_activity').insert(
      events.map((e) => ({
        tenant_id: before.tenant_id,
        lead_id: id,
        user_id: session.user.id,
        kind: e.kind,
        body: e.body ?? null,
        metadata: e.metadata ?? null,
      })),
    )
  }

  return Response.json(after)
}

// Any tenant member can self-assign or unassign themselves.
// Admins can assign anyone in their tenant. Uses PATCH-like semantics but
// separated so it can bypass the admin gate on requireAdmin.
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await requireSession()
  const { id } = await ctx.params

  let body: { assigned_to?: string | null; action?: string }
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  if (body.action !== 'assign') {
    return Response.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const nextAssigneeId = body.assigned_to ?? null
  const admin = createAdminClient()

  const { data: before } = await admin
    .from('leads')
    .select('tenant_id,assigned_to')
    .eq('id', id)
    .maybeSingle()
  if (!before) return Response.json({ error: 'Lead not found.' }, { status: 404 })

  if (!session.isSuperadmin && before.tenant_id !== session.tenantId)
    return Response.json({ error: 'Lead not found.' }, { status: 404 })

  const isAdmin = session.isSuperadmin || session.role === 'admin'
  const selfAssign =
    nextAssigneeId === session.user.id || nextAssigneeId === null
  if (!isAdmin && !selfAssign) {
    return Response.json(
      { error: 'Only admins can assign someone else.' },
      { status: 403 },
    )
  }

  const { data: after, error } = await admin
    .from('leads')
    .update({ assigned_to: nextAssigneeId })
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (before.assigned_to !== nextAssigneeId) {
    await admin.from('lead_activity').insert({
      tenant_id: before.tenant_id,
      lead_id: id,
      user_id: session.user.id,
      kind: 'assigned',
      metadata: { from: before.assigned_to, to: nextAssigneeId },
    })
  }

  return Response.json(after)
}
