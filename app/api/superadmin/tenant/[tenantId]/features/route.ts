import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = RouteContext<'/api/superadmin/tenant/[tenantId]/features'>

export async function PATCH(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const features = {
    team:      !!body.team,
    export:    !!body.export,
    settings:  !!body.settings,
    analytics: !!body.analytics,
    invoicing: !!body.invoicing,
    activity:  !!body.activity,
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ features })
    .eq('id', tenantId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, features })
}
