import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { applyFilter, parseFilter, type EvalRow } from '@/lib/filters'
import { withDefaults, type Features } from '@/lib/features'
import { getModuleConfig, getDefaultModule } from '@/lib/lead-modules'

type LeadRow = EvalRow & { id: string }

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session.tenantId) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const supabase = await createClient()

  // Server-side feature-flag re-check — never trust the client's sidebar visibility.
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('features')
    .eq('id', session.tenantId)
    .maybeSingle()
  const features: Features = withDefaults(
    (tenantRow as { features?: Partial<Features> } | null)?.features
  )
  if (!session.isSuperadmin && !features.export) {
    return Response.json({ error: 'Export not enabled' }, { status: 403 })
  }

  // Optional ?module=<slug> — scope export to a single module and resolve
  // column headers via the module's field config. Absent = default module.
  const url = new URL(req.url)
  const moduleSlug = url.searchParams.get('module')
  const config = moduleSlug
    ? await getModuleConfig(supabase, session.tenantId, moduleSlug)
    : await (async () => {
        const def = await getDefaultModule(supabase, session.tenantId!)
        return def ? await getModuleConfig(supabase, session.tenantId!, def.slug) : null
      })()

  if (!config) {
    return Response.json({ error: 'Module not found' }, { status: 404 })
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('id,created_at,status,custom_data')
    .eq('tenant_id', session.tenantId)
    .eq('module_key', config.slug)
    .order('created_at', { ascending: false })

  const filter = parseFilter(url.searchParams.get('filter'))
  const rows: LeadRow[] = applyFilter((leads ?? []) as LeadRow[], filter)

  // Column order + labels come from the module config so the CSV matches
  // what the user sees on-screen (same principle as the filter evaluator).
  const cols = config.fields.map((f) => f.key)
  const headers = ['Created', 'Status', ...config.fields.map((f) => f.label)]

  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.map(esc).join(','),
    ...rows.map((r) =>
      [r.created_at, r.status, ...cols.map((c) => r.custom_data?.[c])].map(esc).join(',')),
  ].join('\n')

  const filename = `${config.slug}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
