import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RX = /^[+0-9 \-()]{7,20}$/
const MAX_NAME = 120

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = body as { name?: unknown; email?: unknown; mobile?: unknown; requested_role?: unknown }

  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  const mobile = typeof b.mobile === 'string' ? b.mobile.trim() : ''
  const role = typeof b.requested_role === 'string' ? b.requested_role : 'user'

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }
  if (!email || !EMAIL_RX.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (mobile && !MOBILE_RX.test(mobile)) {
    return NextResponse.json({ error: 'Mobile format invalid' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'user') {
    return NextResponse.json({ error: 'Role must be admin or user' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Reject if a pending request for this email + tenant already exists
  const { data: existing } = await admin
    .from('user_creation_requests')
    .select('id')
    .eq('tenant_id', session.tenantId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A pending request for this email already exists' },
      { status: 409 }
    )
  }

  const { data, error } = await admin
    .from('user_creation_requests')
    .insert({
      tenant_id: session.tenantId,
      requested_by: session.user.id,
      name,
      email,
      mobile: mobile || null,
      requested_role: role,
      status: 'pending',
    })
    .select('id, name, email, requested_role, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'user_request.create',
    target_type: 'user_creation_requests',
    target_id: data.id,
    metadata: { name, email, requested_role: role },
  })

  return NextResponse.json(data, { status: 201 })
}
