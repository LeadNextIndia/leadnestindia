'use client'

import { useState } from 'react'
import type { TenantGstConfig } from '@/lib/invoice'

type Props = {
  initial: TenantGstConfig
  onSaved?: (next: TenantGstConfig) => void
}

export function GstConfigForm({ initial, onSaved }: Props) {
  const [gstin, setGstin]                 = useState(initial.gstin ?? '')
  const [address, setAddress]             = useState(initial.company_address ?? '')
  const [state, setState]                 = useState(initial.state ?? '')
  const [stateCode, setStateCode]         = useState(initial.state_code ?? '')
  const [gstRate, setGstRate]             = useState<number>(initial.gst_rate ?? 18)
  const [defaultHsn, setDefaultHsn]       = useState(initial.default_hsn ?? '')
  const [busy, setBusy]                   = useState(false)
  const [msg, setMsg]                     = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setMsg(null)
    setBusy(true)
    const res = await fetch('/api/tenant/gst', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gstin, company_address: address, state, state_code: stateCode,
        gst_rate: Number(gstRate), default_hsn: defaultHsn,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ kind: 'err', text: data.error ?? 'Save failed.' }); return }
    setMsg({ kind: 'ok', text: 'Saved.' })
    onSaved?.({
      gstin: gstin || null,
      company_address: address || null,
      state: state || null,
      state_code: stateCode || null,
      gst_rate: Number(gstRate),
      default_hsn: defaultHsn || null,
    })
  }

  const cgstShare = (Number(gstRate) || 0) / 2

  return (
    <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Company GST details</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Used as the seller info on every invoice. Snapshotted at generation time — changing it later won&apos;t alter past invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="GSTIN" hint="15-character GST number">
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="27AAAAA0000A1Z5"
            maxLength={15}
            className={inputCls}
          />
        </Field>
        <Field label="Default HSN / SAC" hint="Optional, pre-fills new line items">
          <input
            value={defaultHsn}
            onChange={(e) => setDefaultHsn(e.target.value)}
            placeholder="998314"
            className={inputCls}
          />
        </Field>
        <Field label="State" className="sm:col-span-1">
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" className={inputCls} />
        </Field>
        <Field label="State code" hint="2-digit GST state code (e.g. 27 for Maharashtra)">
          <input
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            placeholder="27"
            maxLength={2}
            className={inputCls}
          />
        </Field>
        <Field label="GST rate (%)" hint={`Splits equally: CGST ${cgstShare}% + SGST ${cgstShare}%`}>
          <input
            type="number" min="0" max="40" step="0.5"
            value={gstRate}
            onChange={(e) => setGstRate(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Company address" className="sm:col-span-2">
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Building, Street, Area, City, PIN"
            className={inputCls}
          />
        </Field>
      </div>

      {msg && (
        <p className={msg.kind === 'ok'
          ? 'text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2'
          : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'}>
          {msg.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
      >
        {busy ? 'Saving…' : 'Save GST details'}
      </button>
    </div>
  )
}

const inputCls =
  'mt-0.5 w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Field({
  label, hint, className, children,
}: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}
