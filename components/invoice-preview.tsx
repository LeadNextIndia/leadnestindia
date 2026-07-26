import { formatINR, numberToIndianWords, type Invoice } from '@/lib/invoice'

// Layout is styled to look right on screen AND print — see globals.css @media print
export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const items = invoice.items ?? []
  const half = Number(invoice.gst_rate) / 2
  const showIgst = invoice.inter_state

  return (
    <div id="invoice-print-area" className="bg-white text-gray-900 p-8 max-w-[850px] mx-auto border border-gray-200 rounded-lg print:border-0 print:rounded-none print:shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-300 pb-4 mb-4">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wider">Tax Invoice</h1>
          <div className="text-[11px] text-gray-500 mt-0.5">Original for Recipient</div>
        </div>
        <div className="text-right text-xs space-y-0.5">
          <div><span className="text-gray-500">Invoice No: </span><span className="font-mono font-semibold">{invoice.invoice_number}</span></div>
          <div><span className="text-gray-500">Date: </span><span className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</span></div>
        </div>
      </div>

      {/* Seller + Buyer */}
      <div className="grid grid-cols-2 gap-4 mb-5 text-xs">
        <Party
          title="From"
          name={invoice.seller_name}
          address={invoice.seller_address}
          gstin={invoice.seller_gstin}
          state={invoice.seller_state}
          stateCode={invoice.seller_state_code}
        />
        <Party
          title="Bill To"
          name={invoice.buyer_name}
          address={invoice.buyer_address}
          gstin={invoice.buyer_gstin}
          phone={invoice.buyer_phone}
          email={invoice.buyer_email}
          state={invoice.buyer_state}
          stateCode={invoice.buyer_state_code}
        />
      </div>

      {/* Items table */}
      <table className="w-full text-xs border-collapse mb-3">
        <thead>
          <tr className="bg-gray-100 border-y border-gray-300 text-gray-700">
            <th className="text-left  px-2 py-1.5 w-6">#</th>
            <th className="text-left  px-2 py-1.5">Description</th>
            <th className="text-left  px-2 py-1.5 w-20">HSN/SAC</th>
            <th className="text-right px-2 py-1.5 w-16">Qty</th>
            <th className="text-right px-2 py-1.5 w-24">Rate</th>
            <th className="text-right px-2 py-1.5 w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-gray-200 align-top">
              <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
              <td className="px-2 py-1.5">{it.description || '—'}</td>
              <td className="px-2 py-1.5 font-mono text-gray-600">{it.hsn ?? '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{it.qty}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(it.rate)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(it.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={6} className="text-center px-2 py-4 text-gray-400">No items.</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals + amount in words */}
      <div className="grid grid-cols-2 gap-6 mt-4 text-xs">
        <div className="pt-3 border-t border-gray-200">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Amount in Words</div>
          <div className="text-gray-800 leading-snug">{numberToIndianWords(invoice.total)}</div>
          {invoice.notes && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Notes</div>
              <div className="whitespace-pre-wrap text-gray-700">{invoice.notes}</div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Row label="Subtotal" value={formatINR(invoice.subtotal)} />
          {showIgst ? (
            <Row label={`IGST @ ${invoice.gst_rate}%`} value={formatINR(invoice.igst_amount)} />
          ) : (
            <>
              <Row label={`CGST @ ${half}%`} value={formatINR(invoice.cgst_amount)} />
              <Row label={`SGST @ ${half}%`} value={formatINR(invoice.sgst_amount)} />
            </>
          )}
          <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="grid grid-cols-2 gap-6 mt-10 pt-6 border-t border-gray-200 text-[11px] text-gray-500">
        <div>
          <div className="uppercase tracking-wider mb-6 text-gray-400">Received in good condition</div>
          <div className="border-t border-gray-300 pt-1">Customer signature</div>
        </div>
        <div className="text-right">
          <div className="uppercase tracking-wider mb-1 text-gray-400">For {invoice.seller_name}</div>
          <div className="h-12" />
          <div className="border-t border-gray-300 pt-1 inline-block px-8">Authorised signatory</div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-700">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function Party({
  title, name, address, gstin, phone, email, state, stateCode,
}: {
  title: string
  name: string
  address?: string | null
  gstin?: string | null
  phone?: string | null
  email?: string | null
  state?: string | null
  stateCode?: string | null
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{title}</div>
      <div className="text-sm font-semibold text-gray-900">{name}</div>
      {address && <div className="text-gray-700 whitespace-pre-wrap mt-0.5">{address}</div>}
      <div className="mt-1 space-y-0.5 text-gray-600">
        {gstin && <div><span className="text-gray-500">GSTIN: </span><span className="font-mono">{gstin}</span></div>}
        {(state || stateCode) && <div><span className="text-gray-500">State: </span>{state}{stateCode ? ` (${stateCode})` : ''}</div>}
        {phone && <div><span className="text-gray-500">Phone: </span>{phone}</div>}
        {email && <div><span className="text-gray-500">Email: </span>{email}</div>}
      </div>
    </div>
  )
}
