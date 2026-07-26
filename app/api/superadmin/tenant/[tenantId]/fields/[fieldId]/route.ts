import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = RouteContext<'/api/superadmin/tenant/[tenantId]/fields/[fieldId]'>

export async function PATCH(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId, fieldId } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const updates: Record<string, unknown> = {}
  if (body.label !== undefined)    updates.label    = (body.label as string).trim()
  if (body.type !== undefined)     updates.type     = body.type
  if (body.required !== undefined) updates.required = !!body.required
  if (body.options !== undefined)  updates.options  = body.options
  if (body.active !== undefined)   updates.active   = !!body.active

  if (Object.keys(updates).length === 0)
    return Response.json({ error: 'Nothing to update.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('field_definitions')
    .update(updates)
    .eq('id', fieldId)
    .eq('tenant_id', tenantId)
    .select('id,key,label,type,required,options,active,sort_order')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId, fieldId } = await ctx.params

  const admin = createAdminClient()
  const { error } = await admin
    .from('field_definitions')
    .delete()
    .eq('id', fieldId)
    .eq('tenant_id', tenantId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
