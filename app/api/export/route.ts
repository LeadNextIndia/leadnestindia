import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { applyFilter, parseFilter, type EvalRow } from '@/lib/filters'
import { withDefaults, type Features } from '@/lib/features'

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

  const { data: leads } = await supabase
    .from('leads')
    .select('id,created_at,status,custom_data')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })

  const filter = parseFilter(new URL(req.url).searchParams.get('filter'))
  const rows: LeadRow[] = applyFilter((leads ?? []) as LeadRow[], filter)

  const keys = new Set<string>()
  rows.forEach((r) => Object.keys(r.custom_data ?? {}).forEach((k) => keys.add(k)))
  const cols = [...keys]

  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    ['created_at', 'status', ...cols].map(esc).join(','),
    ...rows.map((r) =>
      [r.created_at, r.status, ...cols.map((c) => r.custom_data?.[c])].map(esc).join(',')),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="leads.csv"',
      // Prevent the browser from caching CSV that contains user data
      'Cache-Control': 'private, no-store',
    },
  })
}
