import { NextRequest } from 'next/server'
import { requireAdmin, requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calcInvoiceTotals,
  fiscalYearLabel,
  nextInvoiceNumber,
  roundTo,
  type InvoiceItem,
} from '@/lib/invoice'

const MAX_ITEMS = 50

function coerceItems(raw: unknown): InvoiceItem[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_ITEMS).map((it): InvoiceItem => {
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

export async function GET() {
  const session = await requireSession()
  if (!session.tenantId && !session.isSuperadmin) return Response.json({ invoices: [] })

  const admin = createAdminClient()
  let q = admin
    .from('invoices')
    .select('id,invoice_number,invoice_date,buyer_name,total,gst_rate,inter_state,created_at')
    .order('invoice_date', { ascending: false })
    .order('created_at',   { ascending: false })

  if (!session.isSuperadmin && session.tenantId) {
    q = q.eq('tenant_id', session.tenantId)
  }

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ invoices: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session.tenantId && !session.isSuperadmin) {
    return Response.json({ error: 'You are not attached to a tenant.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const tenantId = (session.tenantId ?? body.tenant_id) as string | null
  if (!tenantId) return Response.json({ error: 'tenant_id required.' }, { status: 400 })

  const admin = createAdminClient()

  // Load tenant snapshot (seller info + gst defaults)
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select('name,gstin,company_address,state,state_code,gst_rate')
    .eq('id', tenantId)
    .maybeSingle()
  if (tErr) return Response.json({ error: tErr.message }, { status: 500 })
  if (!tenant) return Response.json({ error: 'Tenant not found.' }, { status: 404 })

  const buyerName = String(body.buyer_name ?? '').trim()
  if (!buyerName) return Response.json({ error: 'Buyer name is required.' }, { status: 400 })

  const items = coerceItems(body.items)
  if (items.length === 0) return Response.json({ error: 'At least one line item is required.' }, { status: 400 })

  const gstRate = typeof body.gst_rate === 'number' ? body.gst_rate : Number(tenant.gst_rate ?? 18)
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 40)
    return Response.json({ error: 'GST rate must be between 0 and 40.' }, { status: 400 })

  const interState = !!body.inter_state
  const totals = calcInvoiceTotals(items, gstRate, interState)

  // Generate invoice number: count invoices in current Indian FY for this tenant
  const now = new Date()
  const fy = fiscalYearLabel(now)
  const { count: fyCount } = await admin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .like('invoice_number', `INV/${fy}/%`)
  const invoiceNumber = nextInvoiceNumber(fyCount ?? 0, now)

  const row = {
    tenant_id: tenantId,
    lead_id: (body.lead_id as string | null) ?? null,
    invoice_number: invoiceNumber,
    invoice_date: (body.invoice_date as string | undefined) ?? now.toISOString().slice(0, 10),

    seller_name: tenant.name,
    seller_address: tenant.company_address,
    seller_gstin: tenant.gstin,
    seller_state: tenant.state,
    seller_state_code: tenant.state_code,

    buyer_name: buyerName,
    buyer_address: (body.buyer_address as string | null | undefined) ?? null,
    buyer_gstin: (body.buyer_gstin as string | null | undefined) ?? null,
    buyer_phone: (body.buyer_phone as string | null | undefined) ?? null,
    buyer_email: (body.buyer_email as string | null | undefined) ?? null,
    buyer_state: (body.buyer_state as string | null | undefined) ?? null,
    buyer_state_code: (body.buyer_state_code as string | null | undefined) ?? null,

    items,
    subtotal: totals.subtotal,
    gst_rate: gstRate,
    cgst_amount: totals.cgstAmount,
    sgst_amount: totals.sgstAmount,
    igst_amount: totals.igstAmount,
    total: totals.total,
    inter_state: interState,

    notes: (body.notes as string | null | undefined) ?? null,
    created_by: session.user.id,
  }

  const { data, error } = await admin.from('invoices').insert(row).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
