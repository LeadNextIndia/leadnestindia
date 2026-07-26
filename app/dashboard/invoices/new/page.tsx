import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { withDefaults, type Features } from '@/lib/features'
import type { TenantGstConfig } from '@/lib/invoice'
import { InvoiceEditor } from '@/components/invoice-editor'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ lead?: string }> }

export default async function NewInvoicePage({ searchParams }: Props) {
  const session = await requireAdmin()
  const { lead: leadId } = await searchParams

  const supabase = await createClient()

  let features: Features = withDefaults(null)
  if (session.tenantId) {
    const { data } = await supabase.from('tenants').select('features').eq('id', session.tenantId).maybeSingle()
    features = withDefaults(data?.features as Partial<Features> | null)
  }
  if (!session.isSuperadmin && !features.invoicing) redirect('/dashboard')

  const [{ data: tenantRow }, { data: leadRow }] = await Promise.all([
    session.tenantId
      ? supabase.from('tenants').select('gstin,company_address,state,state_code,gst_rate,default_hsn').eq('id', session.tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    leadId
      ? supabase.from('leads').select('id,custom_data').eq('id', leadId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const gstConfig: TenantGstConfig = {
    gstin:           (tenantRow?.gstin as string | null) ?? null,
    company_address: (tenantRow?.company_address as string | null) ?? null,
    state:           (tenantRow?.state as string | null) ?? null,
    state_code:      (tenantRow?.state_code as string | null) ?? null,
    gst_rate:        Number(tenantRow?.gst_rate ?? 18),
    default_hsn:     (tenantRow?.default_hsn as string | null) ?? null,
  }

  if (!gstConfig.gstin) redirect('/dashboard/invoices')

  // Try to derive buyer from lead.custom_data — best-effort key sniff.
  let leadHint: { id: string; buyer_name: string; buyer_phone?: string | null; buyer_email?: string | null } | null = null
  if (leadRow) {
    const cd = (leadRow.custom_data as Record<string, unknown> | null) ?? {}
    const pick = (keys: string[]): string | null => {
      for (const k of keys) {
        const v = cd[k] ?? cd[k.toLowerCase()] ?? cd[k.replace(/_/g, '')]
        if (v) return String(v)
      }
      return null
    }
    leadHint = {
      id: leadRow.id as string,
      buyer_name: pick(['name', 'full_name', 'customer_name', 'buyer_name']) ?? '',
      buyer_phone: pick(['phone', 'mobile', 'contact', 'phone_number']),
      buyer_email: pick(['email', 'email_address']),
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices"
          className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 dark:border-[var(--border)] rounded px-2 py-1">
          ← All invoices
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">New Invoice</h1>
      </div>

      <InvoiceEditor gstConfig={gstConfig} leadHint={leadHint} />
    </div>
  )
}
