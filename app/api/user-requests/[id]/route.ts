import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireSuperadmin()
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as { action?: unknown; notes?: unknown }
  const action = b.action
  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 5000) : null

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load the request under review
  const { data: reqRow, error: loadErr } = await admin
    .from('user_creation_requests')
    .select('id, tenant_id, name, email, mobile, requested_role, status')
    .eq('id', id)
    .maybeSingle()

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!reqRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reqRow.status !== 'pending') {
    return NextResponse.json({ error: `Already ${reqRow.status}` }, { status: 409 })
  }

  const nowIso = new Date().toISOString()

  if (action === 'reject') {
    const { error: updErr } = await admin
      .from('user_creation_requests')
      .update({
        status: 'rejected',
        reviewed_at: nowIso,
        reviewed_by: session.user.id,
        review_notes: notes,
      })
      .eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    await admin.from('audit_log').insert({
      actor_user_id: session.user.id,
      tenant_id: reqRow.tenant_id,
      action: 'user_request.reject',
      target_type: 'user_creation_requests',
      target_id: id,
      metadata: { email: reqRow.email, notes },
    })

    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // action === 'approve' — provision the user
  const role = reqRow.requested_role as 'admin' | 'user'
  const email = reqRow.email as string
  const tenantId = reqRow.tenant_id as string
  const name = reqRow.name as string

  const { data: existingId } = await admin.rpc('get_user_id_by_email', { p_email: email })

  let mode: 'invited' | 'attached'
  if (existingId) {
    const { error: attachErr } = await admin.from('tenant_users').upsert(
      { user_id: existingId as string, tenant_id: tenantId, role, email },
      { onConflict: 'user_id,tenant_id' }
    )
    if (attachErr) return NextResponse.json({ error: attachErr.message }, { status: 500 })
    mode = 'attached'
  } else {
    const origin = req.headers.get('origin') ?? new URL(req.url).origin
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { tenant_id: tenantId, role, name },
      redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
    })
    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })
    mode = 'invited'
  }

  const { error: updErr } = await admin
    .from('user_creation_requests')
    .update({
      status: 'approved',
      reviewed_at: nowIso,
      reviewed_by: session.user.id,
      review_notes: notes,
    })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: tenantId,
    action: 'user_request.approve',
    target_type: 'user_creation_requests',
    target_id: id,
    metadata: { email, role, mode, notes },
  })

  return NextResponse.json({ ok: true, status: 'approved', mode })
}
