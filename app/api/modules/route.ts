import { NextRequest } from 'next/server'
import { requireSession, requireSuperadmin } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/lead-modules'

// GET — list modules for the current tenant. Any tenant member can read
// (the sidebar renders modules for every user).
export async function GET(req: NextRequest) {
  const session = await requireSession()

  // Superadmins can list modules for any tenant via ?tenant_id=<uuid>.
  // Non-superadmins are locked to their own tenant.
  const url = new URL(req.url)
  const requested = url.searchParams.get('tenant_id')
  const tenantId = session.isSuperadmin && requested ? requested : session.tenantId
  if (!tenantId) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const supabase = session.isSuperadmin ? createAdminClient() : await createClient()
  const { data, error } = await supabase
    .from('lead_modules')
    .select('id,slug,singular,plural,icon,sort_order,is_default,active')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ modules: data ?? [] })
}

// POST — create a new module. Superadmin-only.
// Body must include `tenant_id`. The first module was seeded by the phase9
// migration; this endpoint is for additional modules (Walk-in, etc.).
export async function POST(req: NextRequest) {
  await requireSuperadmin()

  let body: {
    tenant_id?: string
    slug?: string
    singular?: string
    plural?: string
    icon?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const tenantId = (body.tenant_id ?? '').trim()
  if (!tenantId) {
    return Response.json({ error: 'tenant_id is required.' }, { status: 400 })
  }

  const singular = (body.singular ?? '').trim()
  const plural = (body.plural ?? '').trim()
  const rawSlug = (body.slug ?? singular ?? '').trim()
  const slug = slugify(rawSlug)

  if (!singular || !plural) {
    return Response.json({ error: 'Singular and plural names are required.' }, { status: 400 })
  }
  if (!slug) {
    return Response.json({ error: 'Slug is required.' }, { status: 400 })
  }
  if (singular.length > 60 || plural.length > 60) {
    return Response.json({ error: 'Names must be 60 characters or less.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Compute next sort_order (append to end).
  const { data: maxRow } = await admin
    .from('lead_modules')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1

  const { data, error } = await admin
    .from('lead_modules')
    .insert({
      tenant_id: tenantId,
      slug,
      singular,
      plural,
      icon: body.icon ?? null,
      sort_order: nextSort,
      is_default: false,
      active: true,
    })
    .select('id,slug,singular,plural,icon,sort_order,is_default,active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A module with this slug already exists.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
