import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'
import { InvoicePreview } from '@/components/invoice-preview'
import { PrintButtons } from '@/components/print-buttons'
import type { Invoice } from '@/lib/invoice'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function InvoiceViewPage({ params }: Props) {
  const session = await requireSession()
  const { id } = await params

  const admin = createAdminClient()
  const { data } = await admin.from('invoices').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  if (!session.isSuperadmin && data.tenant_id !== session.tenantId) notFound()

  const invoice = data as unknown as Invoice

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/invoices"
            className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 dark:border-[var(--border)] rounded px-2 py-1">
            ← All invoices
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {invoice.invoice_number}
          </h1>
        </div>
        <PrintButtons invoiceNumber={invoice.invoice_number} />
      </div>

      <InvoicePreview invoice={invoice} />
    </div>
  )
}
