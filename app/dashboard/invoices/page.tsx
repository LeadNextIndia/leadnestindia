import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { withDefaults, type Features } from '@/lib/features'
import { formatINR, type TenantGstConfig } from '@/lib/invoice'
import { GstConfigForm } from '@/components/gst-config-form'
import { PlusIcon } from '@/components/icons'

type InvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  buyer_name: string
  total: number
  gst_rate: number
  inter_state: boolean
  created_at: string
}

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  const session = await requireSession()
  const supabase = await createClient()

  // Gate on feature flag (superadmin bypasses)
  let features: Features = withDefaults(null)
  if (session.tenantId) {
    const { data } = await supabase.from('tenants').select('features').eq('id', session.tenantId).maybeSingle()
    features = withDefaults(data?.features as Partial<Features> | null)
  }
  const enabled = session.isSuperadmin || features.invoicing
  if (!enabled) redirect('/dashboard')

  const isAdmin = session.isSuperadmin || session.role === 'admin'

  const [{ data: invoicesRaw }, { data: tenantRow }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id,invoice_number,invoice_date,buyer_name,total,gst_rate,inter_state,created_at')
      .order('invoice_date', { ascending: false })
      .order('created_at',   { ascending: false }),
    session.tenantId
      ? supabase.from('tenants').select('gstin,company_address,state,state_code,gst_rate,default_hsn').eq('id', session.tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const invoices: InvoiceRow[] = (invoicesRaw ?? []) as InvoiceRow[]
  const gstConfig: TenantGstConfig = {
    gstin:           (tenantRow?.gstin as string | null) ?? null,
    company_address: (tenantRow?.company_address as string | null) ?? null,
    state:           (tenantRow?.state as string | null) ?? null,
    state_code:      (tenantRow?.state_code as string | null) ?? null,
    gst_rate:        Number(tenantRow?.gst_rate ?? 18),
    default_hsn:     (tenantRow?.default_hsn as string | null) ?? null,
  }
  const gstConfigured = !!gstConfig.gstin

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'} · GST-compliant
          </p>
        </div>
        {isAdmin && gstConfigured && (
          <Link href="/dashboard/invoices/new"
            className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5">
            <PlusIcon className="w-4 h-4" /> New Invoice
          </Link>
        )}
      </div>

      {isAdmin && !gstConfigured && (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <strong>Set up your company GST details first.</strong> These appear as the seller on every invoice and must be filled before generating one.
          </div>
          <GstConfigForm initial={gstConfig} />
        </>
      )}

      {isAdmin && gstConfigured && (
        <details className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            Company GST details (update)
          </summary>
          <div className="mt-3">
            <GstConfigForm initial={gstConfig} />
          </div>
        </details>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Bill To</th>
              <th className="text-left px-4 py-2 font-medium">GST</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50/60 dark:hover:bg-[var(--surface-muted)]">
                <td className="px-4 py-2 font-mono text-xs text-gray-800 dark:text-gray-100">{inv.invoice_number}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-xs">
                  {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
                </td>
                <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{inv.buyer_name}</td>
                <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                  {inv.gst_rate}% · {inv.inter_state ? 'IGST' : 'CGST+SGST'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                  {formatINR(inv.total)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/dashboard/invoices/${inv.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">View →</Link>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No invoices yet.{' '}
                  {isAdmin && gstConfigured && (
                    <Link href="/dashboard/invoices/new" className="text-indigo-600 hover:underline">Create the first one</Link>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
