import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return Response.json({ error: 'You are not attached to a tenant.' }, { status: 400 })
  }

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const userId = body.userId
  if (!userId) return Response.json({ error: 'Missing userId.' }, { status: 400 })
  if (userId === session.user.id) {
    return Response.json({ error: 'You cannot remove yourself.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Refuse to remove the last admin
  const { data: target } = await admin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', session.tenantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (target?.role === 'admin') {
    const { count } = await admin
      .from('tenant_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return Response.json(
        { error: 'This is your only admin. Promote another member before removing.' },
        { status: 400 }
      )
    }
  }

  const { error } = await admin
    .from('tenant_users')
    .delete()
    .eq('tenant_id', session.tenantId)
    .eq('user_id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
