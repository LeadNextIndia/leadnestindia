import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

// Basic GSTIN sanity check: 15 chars, 2-digit state + 10-char PAN + 1 + Z + 1
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin()
  if (!session.tenantId) {
    return Response.json({ error: 'You are not attached to a tenant.' }, { status: 400 })
  }

  let body: {
    gstin?: string | null
    company_address?: string | null
    state?: string | null
    state_code?: string | null
    gst_rate?: number
    default_hsn?: string | null
  }
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const gstin = body.gstin?.trim().toUpperCase() || null
  if (gstin && !GSTIN_RE.test(gstin)) {
    return Response.json({ error: 'GSTIN must be a valid 15-character GST number.' }, { status: 400 })
  }

  const stateCode = body.state_code?.trim() || null
  if (stateCode && !/^[0-9]{1,2}$/.test(stateCode)) {
    return Response.json({ error: 'State code must be a 1- or 2-digit number.' }, { status: 400 })
  }

  const gstRate = typeof body.gst_rate === 'number' ? body.gst_rate : undefined
  if (gstRate !== undefined && (gstRate < 0 || gstRate > 40)) {
    return Response.json({ error: 'GST rate must be between 0 and 40.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.gstin !== undefined)           updates.gstin           = gstin
  if (body.company_address !== undefined) updates.company_address = body.company_address?.trim() || null
  if (body.state !== undefined)           updates.state           = body.state?.trim() || null
  if (body.state_code !== undefined)      updates.state_code      = stateCode
  if (body.gst_rate !== undefined)        updates.gst_rate        = gstRate
  if (body.default_hsn !== undefined)     updates.default_hsn     = body.default_hsn?.trim() || null

  if (Object.keys(updates).length === 0)
    return Response.json({ error: 'Nothing to update.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants')
    .update(updates)
    .eq('id', session.tenantId)
    .select('gstin,company_address,state,state_code,gst_rate,default_hsn')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, gst: data })
}
