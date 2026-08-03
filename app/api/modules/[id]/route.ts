import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

// PATCH — rename / reorder / toggle active. Superadmin-only.
// Slug is intentionally immutable to keep URLs and leads.module_key stable.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()

  const { id } = await ctx.params

  let body: {
    singular?: string
    plural?: string
    icon?: string | null
    sort_order?: number
    active?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.singular !== undefined) {
    const s = body.singular.trim()
    if (!s || s.length > 60) return Response.json({ error: 'Invalid singular.' }, { status: 400 })
    updates.singular = s
  }
  if (body.plural !== undefined) {
    const p = body.plural.trim()
    if (!p || p.length > 60) return Response.json({ error: 'Invalid plural.' }, { status: 400 })
    updates.plural = p
  }
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.active !== undefined) updates.active = body.active

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('lead_modules')
    .select('tenant_id,is_default,active')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return Response.json({ error: 'Module not found.' }, { status: 404 })
  // Never let anyone deactivate the default module — every tenant needs one.
  if (existing.is_default && body.active === false) {
    return Response.json({ error: 'The default module cannot be deactivated.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('lead_modules')
    .update(updates)
    .eq('id', id)
    .select('id,slug,singular,plural,icon,sort_order,is_default,active')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// DELETE — remove a non-default module. Superadmin-only.
// Query param `reassign_to=<slug>` moves any leads on this module to another
// module before deletion. Without it, delete is refused if leads exist.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()

  const { id } = await ctx.params
  const reassignTo = new URL(req.url).searchParams.get('reassign_to')

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('lead_modules')
    .select('tenant_id,slug,is_default')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return Response.json({ error: 'Module not found.' }, { status: 404 })
  if (existing.is_default) {
    return Response.json({ error: 'The default module cannot be deleted.' }, { status: 400 })
  }

  const { count } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', existing.tenant_id)
    .eq('module_key', existing.slug)

  if ((count ?? 0) > 0) {
    if (!reassignTo) {
      return Response.json(
        {
          error:
            'This module has leads. Pass ?reassign_to=<slug> to move them to another module first.',
          leadCount: count,
        },
        { status: 409 },
      )
    }
    // Verify the target module exists on the same tenant.
    const { data: target } = await admin
      .from('lead_modules')
      .select('slug')
      .eq('tenant_id', existing.tenant_id)
      .eq('slug', reassignTo)
      .maybeSingle()
    if (!target) {
      return Response.json({ error: 'Target module not found.' }, { status: 400 })
    }
    const { error: reErr } = await admin
      .from('leads')
      .update({ module_key: reassignTo })
      .eq('tenant_id', existing.tenant_id)
      .eq('module_key', existing.slug)
    if (reErr) return Response.json({ error: reErr.message }, { status: 500 })
  }

  const { error } = await admin.from('lead_modules').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
