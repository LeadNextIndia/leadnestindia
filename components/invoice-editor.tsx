'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, TrashIcon } from './icons'
import {
  calcInvoiceTotals,
  calcItemAmount,
  formatINR,
  type InvoiceItem,
  type TenantGstConfig,
} from '@/lib/invoice'

type LeadHint = {
  id: string
  buyer_name: string
  buyer_phone?: string | null
  buyer_email?: string | null
}

type Props = {
  gstConfig: TenantGstConfig
  leadHint: LeadHint | null
}

function emptyItem(defaultHsn: string | null): InvoiceItem {
  return { description: '', hsn: defaultHsn ?? null, qty: 1, rate: 0, amount: 0 }
}

export function InvoiceEditor({ gstConfig, leadHint }: Props) {
  const router = useRouter()

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [buyerName, setBuyerName]     = useState(leadHint?.buyer_name ?? '')
  const [buyerPhone, setBuyerPhone]   = useState(leadHint?.buyer_phone ?? '')
  const [buyerEmail, setBuyerEmail]   = useState(leadHint?.buyer_email ?? '')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerGstin, setBuyerGstin]   = useState('')
  const [buyerState, setBuyerState]   = useState('')
  const [buyerStateCode, setBuyerStateCode] = useState('')

  const [items, setItems] = useState<InvoiceItem[]>([emptyItem(gstConfig.default_hsn)])
  const [gstRate, setGstRate]   = useState<number>(gstConfig.gst_rate ?? 18)
  const [interState, setInterState] = useState<boolean>(false)
  const [notes, setNotes] = useState('')

  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  const totals = useMemo(
    () => calcInvoiceTotals(items, Number(gstRate) || 0, interState),
    [items, gstRate, interState],
  )

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      const next = { ...it, ...patch }
      next.amount = calcItemAmount(Number(next.qty) || 0, Number(next.rate) || 0)
      return next
    }))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(gstConfig.default_hsn)])
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    setErr(null)
    if (!buyerName.trim()) { setErr('Buyer name is required.'); return }
    if (items.length === 0 || items.every((it) => !it.description.trim() && !it.amount)) {
      setErr('Add at least one line item.'); return
    }
    setBusy(true)
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadHint?.id ?? null,
        invoice_date: invoiceDate,
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone?.trim() || null,
        buyer_email: buyerEmail?.trim() || null,
        buyer_address: buyerAddress?.trim() || null,
        buyer_gstin: buyerGstin?.trim().toUpperCase() || null,
        buyer_state: buyerState?.trim() || null,
        buyer_state_code: buyerStateCode?.trim() || null,
        items: items.filter((it) => it.description.trim() || it.amount > 0),
        gst_rate: Number(gstRate),
        inter_state: interState,
        notes: notes?.trim() || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(data.error ?? 'Save failed.'); return }
    router.push(`/dashboard/invoices/${data.id}`)
  }

  const half = (Number(gstRate) || 0) / 2

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Invoice details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Invoice date">
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="GST rate (%)" hint={interState ? `IGST ${gstRate}%` : `CGST ${half}% + SGST ${half}%`}>
            <input type="number" min="0" max="40" step="0.5" value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-6">
            <input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)}
              className="rounded border-gray-300" />
            Inter-state sale (use IGST)
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Bill To</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name" required>
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="GSTIN (if registered)">
            <input value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
              maxLength={15} placeholder="Optional" className={inputCls} />
          </Field>
          <Field label="Phone">
            <input value={buyerPhone ?? ''} onChange={(e) => setBuyerPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" value={buyerEmail ?? ''} onChange={(e) => setBuyerEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea rows={2} value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} className={inputCls} />
          </Field>
          <Field label="State">
            <input value={buyerState} onChange={(e) => setBuyerState(e.target.value)} className={inputCls} />
          </Field>
          <Field label="State code">
            <input value={buyerStateCode} onChange={(e) => setBuyerStateCode(e.target.value)} maxLength={2} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Line items</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-2 py-1">Description</th>
                <th className="text-left px-2 py-1 w-24">HSN/SAC</th>
                <th className="text-right px-2 py-1 w-20">Qty</th>
                <th className="text-right px-2 py-1 w-28">Rate</th>
                <th className="text-right px-2 py-1 w-32">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">
                    <input value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="e.g. Consulting services"
                      className={inputCls} />
                  </td>
                  <td className="px-2 py-1">
                    <input value={it.hsn ?? ''} onChange={(e) => updateItem(i, { hsn: e.target.value || null })}
                      className={inputCls} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" value={it.qty}
                      onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                      className={inputCls + ' text-right'} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" value={it.rate}
                      onChange={(e) => updateItem(i, { rate: Number(e.target.value) })}
                      className={inputCls + ' text-right'} />
                  </td>
                  <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100 tabular-nums">
                    {formatINR(it.amount)}
                  </td>
                  <td className="px-1">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-1">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addItem}
          className="inline-flex items-center gap-1 text-xs border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]">
          <PlusIcon className="w-3 h-3" /> Add item
        </button>

        {/* Totals */}
        <div className="mt-4 border-t border-gray-100 dark:border-[var(--border)] pt-3 space-y-1 max-w-sm ml-auto text-sm">
          <Row label="Subtotal" value={formatINR(totals.subtotal)} />
          {interState ? (
            <Row label={`IGST @ ${gstRate}%`} value={formatINR(totals.igstAmount)} />
          ) : (
            <>
              <Row label={`CGST @ ${half}%`} value={formatINR(totals.cgstAmount)} />
              <Row label={`SGST @ ${half}%`} value={formatINR(totals.sgstAmount)} />
            </>
          )}
          <Row label="Total" value={formatINR(totals.total)} bold />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5">
        <Field label="Notes (shown on invoice)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, bank details, thank-you message…" className={inputCls} />
        </Field>
      </div>

      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>
      )}

      <div className="flex gap-2">
        <button onClick={save} disabled={busy}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2">
          {busy ? 'Generating…' : 'Generate invoice'}
        </button>
        <button onClick={() => router.back()}
          className="border border-gray-200 dark:border-[var(--border)] text-sm rounded-md px-4 py-2 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]">
          Cancel
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'mt-0.5 w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Field({
  label, hint, required, className, children,
}: { label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-200 dark:border-[var(--border)]' : 'text-gray-600 dark:text-gray-300'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
