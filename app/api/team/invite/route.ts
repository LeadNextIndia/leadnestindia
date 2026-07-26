import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return Response.json({ error: 'You are not attached to a tenant.' }, { status: 400 })
  }

  let body: { email?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const role  = body.role
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Please enter a valid email.' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'user') {
    return Response.json({ error: 'Role must be admin or user.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // If the email already has an auth.users row, just attach them to the tenant.
  const { data: existingId } = await admin.rpc('get_user_id_by_email', { p_email: email })

  if (existingId) {
    const { error } = await admin
      .from('tenant_users')
      .upsert(
        { user_id: existingId, tenant_id: session.tenantId, role, email },
        { onConflict: 'user_id,tenant_id' }
      )
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, mode: 'added' })
  }

  // Otherwise send a real invite — the trigger will create the tenant_users row on signup.
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { tenant_id: session.tenantId, role },
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, mode: 'invited' })
}
