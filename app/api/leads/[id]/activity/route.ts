import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireSession()
  const { id } = await ctx.params

  const admin = createAdminClient()

  // Enforce tenant scope
  const { data: lead } = await admin.from('leads').select('tenant_id').eq('id', id).maybeSingle()
  if (!lead) return Response.json({ error: 'Lead not found.' }, { status: 404 })
  if (!session.isSuperadmin && lead.tenant_id !== session.tenantId)
    return Response.json({ error: 'Lead not found.' }, { status: 404 })

  const { data, error } = await admin
    .from('lead_activity')
    .select('id,kind,body,metadata,created_at,user_id')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Resolve user emails so the client doesn't have to
  const userIds = Array.from(
    new Set((data ?? []).map((a) => a.user_id).filter((u): u is string => !!u)),
  )
  const emails: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: members } = await admin
      .from('tenant_users')
      .select('user_id,email')
      .in('user_id', userIds)
    ;(members ?? []).forEach((m) => {
      if (m.email) emails[m.user_id as string] = m.email as string
    })
  }

  return Response.json({
    activity: (data ?? []).map((a) => ({
      ...a,
      user_email: a.user_id ? emails[a.user_id] ?? null : null,
    })),
  })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await requireSession()
  const { id } = await ctx.params

  let body: { body?: string }
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const text = (body.body ?? '').trim()
  if (!text) return Response.json({ error: 'Note cannot be empty.' }, { status: 400 })
  if (text.length > 2000) return Response.json({ error: 'Note is too long (max 2000 chars).' }, { status: 400 })

  const admin = createAdminClient()

  const { data: lead } = await admin.from('leads').select('tenant_id').eq('id', id).maybeSingle()
  if (!lead) return Response.json({ error: 'Lead not found.' }, { status: 404 })
  if (!session.isSuperadmin && lead.tenant_id !== session.tenantId)
    return Response.json({ error: 'Lead not found.' }, { status: 404 })

  // Gate manual notes behind the activity feature flag (superadmin bypasses).
  if (!session.isSuperadmin) {
    const { data: t } = await admin.from('tenants').select('features').eq('id', lead.tenant_id).maybeSingle()
    const features = (t?.features ?? {}) as Record<string, unknown>
    if (!features.activity) {
      return Response.json({ error: 'Activity notes are not enabled for your plan.' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('lead_activity')
    .insert({
      tenant_id: lead.tenant_id,
      lead_id: id,
      user_id: session.user.id,
      kind: 'note',
      body: text,
    })
    .select('id,kind,body,metadata,created_at,user_id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ...data, user_email: session.user.email ?? null })
}
