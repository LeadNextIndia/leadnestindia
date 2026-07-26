import { NextRequest } from 'next/server'
import { requireAdmin, requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcInvoiceTotals, roundTo, type InvoiceItem } from '@/lib/invoice'

type Ctx = { params: Promise<{ id: string }> }

function coerceItems(raw: unknown): InvoiceItem[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 50).map((it) => {
    const r = it as Record<string, unknown>
    const qty = Number(r.qty ?? 0)
    const rate = Number(r.rate ?? 0)
    const amount = Number(r.amount ?? roundTo(qty * rate))
    return {
      description: String(r.description ?? '').trim(),
      hsn: r.hsn ? String(r.hsn).trim() : null,
      qty: Number.isFinite(qty) ? qty : 0,
      rate: Number.isFinite(rate) ? rate : 0,
      amount: Number.isFinite(amount) ? roundTo(amount) : 0,
    }
  })
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireSession()
  const { id } = await ctx.params

  const admin = createAdminClient()
  const { data, error } = await admin.from('invoices').select('*').eq('id', id).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  if (!session.isSuperadmin && data.tenant_id !== session.tenantId)
    return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  return Response.json(data)
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin()
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('invoices').select('*').eq('id', id).maybeSingle()
  if (!existing) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  if (!session.isSuperadmin && existing.tenant_id !== session.tenantId)
    return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  const items = body.items !== undefined ? coerceItems(body.items) : (existing.items as InvoiceItem[])
  const gstRate = body.gst_rate !== undefined ? Number(body.gst_rate) : Number(existing.gst_rate)
  const interState = body.inter_state !== undefined ? !!body.inter_state : !!existing.inter_state

  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 40)
    return Response.json({ error: 'GST rate must be between 0 and 40.' }, { status: 400 })

  const totals = calcInvoiceTotals(items, gstRate, interState)

  const updates: Record<string, unknown> = {
    items,
    gst_rate: gstRate,
    inter_state: interState,
    subtotal: totals.subtotal,
    cgst_amount: totals.cgstAmount,
    sgst_amount: totals.sgstAmount,
    igst_amount: totals.igstAmount,
    total: totals.total,
    updated_at: new Date().toISOString(),
  }

  const passThrough = [
    'invoice_date', 'buyer_name', 'buyer_address', 'buyer_gstin',
    'buyer_phone', 'buyer_email', 'buyer_state', 'buyer_state_code', 'notes',
  ]
  for (const key of passThrough) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const { data, error } = await admin.from('invoices').update(updates).eq('id', id).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin()
  const { id } = await ctx.params

  const admin = createAdminClient()
  const { data: existing } = await admin.from('invoices').select('tenant_id').eq('id', id).maybeSingle()
  if (!existing) return Response.json({ ok: true }) // already gone
  if (!session.isSuperadmin && existing.tenant_id !== session.tenantId)
    return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  const { error } = await admin.from('invoices').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
