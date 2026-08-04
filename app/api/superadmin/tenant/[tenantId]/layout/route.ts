import { NextRequest } from 'next/server'
import { requireSuperadmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  withLayoutDefaults,
  LEADS_PAGE_SECTION_TYPES,
  type LeadsPageSection,
  type LeadsPageSectionType,
} from '@/lib/layout-config'

type Ctx = { params: Promise<{ tenantId: string }> }

// GET — resolved layout config for the tenant. Superadmin-only.
export async function GET(_req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId } = await ctx.params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants')
    .select('layout_config')
    .eq('id', tenantId)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ config: withLayoutDefaults(data?.layout_config) })
}

// PATCH — replace the tenant's leads-page section list.
// Body: { sections: Array<{ type, visible }> }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  await requireSuperadmin()
  const { tenantId } = await ctx.params

  let body: { sections?: Array<{ type: string; visible?: boolean }> }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const raw = body.sections
  if (!Array.isArray(raw) || raw.length === 0) {
    return Response.json({ error: 'sections must be a non-empty array.' }, { status: 400 })
  }

  const validTypes = new Set(LEADS_PAGE_SECTION_TYPES as readonly string[])
  const seen = new Set<LeadsPageSectionType>()
  const sections: LeadsPageSection[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object' || !validTypes.has(s.type)) {
      return Response.json({ error: `Invalid section type: ${s?.type}` }, { status: 400 })
    }
    if (seen.has(s.type as LeadsPageSectionType)) {
      return Response.json({ error: `Duplicate section: ${s.type}` }, { status: 400 })
    }
    seen.add(s.type as LeadsPageSectionType)
    sections.push({ type: s.type as LeadsPageSectionType, visible: s.visible !== false })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('tenants')
    .select('layout_config')
    .eq('id', tenantId)
    .maybeSingle()

  const nextConfig = withLayoutDefaults({
    ...(existing?.layout_config as object | null),
    leadsPage: { sections },
  })

  const { error } = await admin
    .from('tenants')
    .update({ layout_config: nextConfig })
    .eq('id', tenantId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, config: nextConfig })
}
