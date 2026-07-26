import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const session = await requireSuperadmin()

  let body: { companyName?: string; adminEmail?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const companyName = (body.companyName ?? '').trim()
  const adminEmail  = (body.adminEmail ?? '').trim().toLowerCase()

  if (!companyName) return Response.json({ error: 'Company name is required.' }, { status: 400 })
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return Response.json({ error: 'Please enter a valid admin email.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Create the tenant
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .insert({ name: companyName, created_by: session.user.id })
    .select('id')
    .single()

  if (tErr || !tenant) {
    return Response.json({ error: tErr?.message ?? 'Could not create tenant.' }, { status: 500 })
  }

  const tenantId = tenant.id as string

  // 2. If the admin already has an auth user, attach them; else send an invite.
  const { data: existingId } = await admin.rpc('get_user_id_by_email', { p_email: adminEmail })

  if (existingId) {
    const { error } = await admin
      .from('tenant_users')
      .upsert(
        { user_id: existingId, tenant_id: tenantId, role: 'admin', email: adminEmail },
        { onConflict: 'user_id,tenant_id' }
      )
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, tenantId, mode: 'added' })
  }

  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  const { error: iErr } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
    data: { tenant_id: tenantId, role: 'admin' },
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  })

  if (iErr) {
    // Roll back: delete the tenant we just created so we don't leave orphans
    await admin.from('tenants').delete().eq('id', tenantId)
    return Response.json({ error: iErr.message }, { status: 400 })
  }

  return Response.json({ ok: true, tenantId, mode: 'invited' })
}
