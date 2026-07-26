import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = RouteContext<'/api/superadmin/tenant/[tenantId]/fields'>

export async function GET(_req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId } = await ctx.params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('field_definitions')
    .select('id,key,label,type,required,options,active,sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const label = (body.label as string ?? '').trim()
  const type  = body.type as string
  const required = !!body.required
  const options  = body.options ?? null

  if (!label) return Response.json({ error: 'Label is required.' }, { status: 400 })
  const validTypes = ['text','number','email','tel','date','select','textarea']
  if (!validTypes.includes(type)) return Response.json({ error: 'Invalid type.' }, { status: 400 })

  // Auto-generate key from label
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const admin = createAdminClient()

  // sort_order = max existing + 1
  const { data: existing } = await admin
    .from('field_definitions')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = ((existing?.sort_order as number) ?? -1) + 1

  const { data, error } = await admin
    .from('field_definitions')
    .insert({ tenant_id: tenantId, key, label, type, required, options, sort_order })
    .select('id,key,label,type,required,options,active,sort_order')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}
