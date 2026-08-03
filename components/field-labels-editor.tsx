'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, TrashIcon } from '@/components/icons'

export type EditableField = {
  id: string
  key: string
  label: string
  type: string
}

const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'email',    label: 'Email' },
  { value: 'tel',      label: 'Phone' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'textarea', label: 'Long text' },
]

export function FieldLabelsEditor({ initialFields }: { initialFields: EditableField[] }) {
  const router = useRouter()
  const [fields, setFields] = useState<EditableField[]>(initialFields)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; forId?: string } | null>(null)

  // Add-field form state
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('text')
  const [newRequired, setNewRequired] = useState(false)
  const [newOptions, setNewOptions] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  function draftFor(id: string, currentLabel: string): string {
    return drafts[id] ?? currentLabel
  }

  async function saveRename(id: string, currentLabel: string) {
    const next = draftFor(id, currentLabel).trim()
    if (!next) {
      setMsg({ kind: 'err', text: 'Label required', forId: id })
      return
    }
    if (next === currentLabel) {
      setDrafts((d) => { const c = { ...d }; delete c[id]; return c })
      return
    }
    setSavingId(id)
    setMsg(null)
    const res = await fetch(`/api/tenant/field-labels/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: next }),
    })
    const json = await res.json().catch(() => ({}))
    setSavingId(null)
    if (!res.ok) {
      setMsg({ kind: 'err', text: json.error ?? 'Save failed', forId: id })
      return
    }
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label: next } : f)))
    setDrafts((d) => { const c = { ...d }; delete c[id]; return c })
    setMsg({ kind: 'ok', text: 'Saved', forId: id })
    router.refresh()
  }

  async function deleteField(id: string, label: string) {
    if (!confirm(`Delete field "${label}"?\n\nExisting lead data will remain in the database, but the field will no longer appear on new leads or in the leads table.`)) return
    setSavingId(id)
    setMsg(null)
    const res = await fetch(`/api/tenant/field-labels/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    setSavingId(null)
    if (!res.ok) {
      setMsg({ kind: 'err', text: json.error ?? 'Delete failed', forId: id })
      return
    }
    setFields((prev) => prev.filter((f) => f.id !== id))
    router.refresh()
  }

  async function addField(e: React.FormEvent) {
    e.preventDefault()
    setAddBusy(true)
    setAddErr(null)

    const options =
      newType === 'select'
        ? newOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined

    const res = await fetch('/api/tenant/field-labels', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: newLabel.trim(),
        type: newType,
        required: newRequired,
        ...(options ? { options } : {}),
      }),
    })
    const json = await res.json().catch(() => ({}))
    setAddBusy(false)
    if (!res.ok) {
      setAddErr(json.error ?? 'Add failed')
      return
    }
    setFields((prev) => [
      ...prev,
      { id: json.id, key: json.key, label: json.label, type: json.type },
    ])
    setNewLabel('')
    setNewType('text')
    setNewRequired(false)
    setNewOptions('')
    setShowAdd(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
          Rename how each field appears in your Leads table and new-lead form.
          You can also add new fields or remove ones you no longer use.
          The internal key is auto-generated from the label.
        </p>
        <button
          type="button"
          onClick={() => { setShowAdd((v) => !v); setAddErr(null) }}
          className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 transition"
        >
          <PlusIcon className="w-4 h-4" /> Add field
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={addField}
          className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/10 p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-gray-800 dark:text-gray-100">New field</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Display label</label>
              <input
                required
                maxLength={80}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Phone Number"
                className="mt-0.5 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="mt-0.5 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200 pb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded border-gray-300 dark:border-[var(--border)]"
              />
              Required
            </label>
          </div>
          {newType === 'select' && (
            <div>
              <label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Options (comma-separated)
              </label>
              <input
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
                className="mt-0.5 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          {addErr && (
            <p className="text-xs text-red-700 dark:text-red-300">{addErr}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addBusy}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-3 py-1.5 transition"
            >
              {addBusy ? 'Adding…' : 'Add field'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {fields.length === 0 && !showAdd ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No fields configured yet. Click <strong>Add field</strong> to create the first one.
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Field key</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Display label</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
              {fields.map((f) => {
                const currentDraft = draftFor(f.id, f.label)
                const dirty = currentDraft !== f.label
                const rowMsg = msg && msg.forId === f.id ? msg : null
                const busy = savingId === f.id
                return (
                  <tr key={f.id}>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                      {f.key}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 capitalize">
                      {f.type}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={currentDraft}
                        onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                        maxLength={80}
                        className="w-full max-w-sm border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      {rowMsg && (
                        <div
                          className={
                            'text-[11px] mt-1 ' +
                            (rowMsg.kind === 'ok'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400')
                          }
                        >
                          {rowMsg.text}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveRename(f.id, f.label)}
                          disabled={!dirty || busy}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-md px-3 py-1 transition"
                        >
                          {busy ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteField(f.id, f.label)}
                          disabled={busy}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-40"
                          title="Delete this field"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
