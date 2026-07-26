import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyFilter, parseFilter, type EvalRow } from '@/lib/filters'

type LeadRow = EvalRow & { id: string }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('id,created_at,status,custom_data')
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
    },
  })
}
