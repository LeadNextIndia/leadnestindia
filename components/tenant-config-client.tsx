'use client'

import { useState, useTransition } from 'react'
import { PlusIcon, TrashIcon } from '@/components/icons'

type FieldDef = {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  options: string[] | null
  active: boolean
  sort_order: number
}

import type { Features } from '@/lib/features'

type TenantUser = {
  user_id: string
  email: string | null
  role: 'admin' | 'user'
  created_at: string
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

const FEATURE_LIST: { key: keyof Features; label: string; desc: string; paid?: boolean }[] = [
  { key: 'team',      label: 'Team',      desc: 'Company admins can invite/manage users.' },
  { key: 'export',    label: 'Export',    desc: 'Company admins can download leads as CSV.' },
  { key: 'analytics', label: 'Analytics', desc: 'Charts, advanced filter builder, and saved views on the Leads page.', paid: true },
  { key: 'invoicing', label: 'Invoicing', desc: 'GST-compliant invoice generation from leads, with print / download PDF.', paid: true },
  { key: 'activity',  label: 'Notes & activity timeline', desc: 'Team notes on each lead plus an auto-logged history of status/assignee/edits.', paid: true },
  { key: 'settings',  label: 'Settings',  desc: 'Settings page visible (coming soon).' },
]

export function TenantConfigClient({
  tenantId,
  initialFields,
  initialFeatures,
  initialUsers,
}: {
  tenantId: string
  initialFields: FieldDef[]
  initialFeatures: Features
  initialUsers: TenantUser[]
}) {
  const [fields, setFields] = useState<FieldDef[]>(initialFields)
  const [features, setFeatures] = useState<Features>(initialFeatures)
  const users = initialUsers
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [featureSaved, setFeatureSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // ── Add field form state ──────────────────────────────────────────
  const [newLabel, setNewLabel]       = useState('')
  const [newType, setNewType]         = useState('text')
  const [newRequired, setNewRequired] = useState(false)
  const [newOptions, setNewOptions]   = useState('')

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const body: Record<string, unknown> = { label: newLabel, type: newType, required: newRequired }
    if (newType === 'select') body.options = newOptions.split(',').map((s) => s.trim()).filter(Boolean)

    const res = await fetch(`/api/superadmin/tenant/${tenantId}/fields`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ kind: 'err', text: data.error ?? 'Failed to add field.' }); return }
    setFields((prev) => [...prev, data])
    setNewLabel(''); setNewType('text'); setNewRequired(false); setNewOptions('')
    setShowAddForm(false)
  }

  // ── Inline edit state ─────────────────────────────────────────────
  const [editLabel, setEditLabel]       = useState('')
  const [editType, setEditType]         = useState('text')
  const [editRequired, setEditRequired] = useState(false)
  const [editActive, setEditActive]     = useState(true)
  const [editOptions, setEditOptions]   = useState('')

  function startEdit(f: FieldDef) {
    setEditingId(f.id)
    setEditLabel(f.label)
    setEditType(f.type)
    setEditRequired(f.required)
    setEditActive(f.active)
    setEditOptions(Array.isArray(f.options) ? f.options.join(', ') : '')
    setMsg(null)
  }

  async function submitEdit(e: React.FormEvent, fieldId: string) {
    e.preventDefault()
    setMsg(null)
    const body: Record<string, unknown> = { label: editLabel, type: editType, required: editRequired, active: editActive }
    if (editType === 'select') body.options = editOptions.split(',').map((s) => s.trim()).filter(Boolean)
    else body.options = null

    const res = await fetch(`/api/superadmin/tenant/${tenantId}/fields/${fieldId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ kind: 'err', text: data.error ?? 'Failed to update.' }); return }
    setFields((prev) => prev.map((f) => (f.id === fieldId ? data : f)))
    setEditingId(null)
  }

  function deleteField(fieldId: string, label: string) {
    if (!confirm(`Delete field "${label}"? This won't remove existing lead data, but the field won't appear on new leads.`)) return
    startTransition(async () => {
      setMsg(null)
      const res = await fetch(`/api/superadmin/tenant/${tenantId}/fields/${fieldId}`, { method: 'DELETE' })
      if (!res.ok) { setMsg({ kind: 'err', text: 'Failed to delete.' }); return }
      setFields((prev) => prev.filter((f) => f.id !== fieldId))
    })
  }

  // ── Feature toggles ───────────────────────────────────────────────
  async function saveFeatures() {
    setMsg(null)
    const res = await fetch(`/api/superadmin/tenant/${tenantId}/features`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(features),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ kind: 'err', text: data.error ?? 'Failed to save.' }); return }
    setFeatureSaved(true)
    setTimeout(() => setFeatureSaved(false), 2000)
  }

  return (
    <div className="space-y-6">

      {/* ── Members ── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Members</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {users.length} {users.length === 1 ? 'user is' : 'users are'} associated with this company.
            </p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.user_id} className="hover:bg-gray-50/60">
                <td className="px-4 py-2.5 text-gray-900 font-medium">
                  {u.email ?? <span className="text-gray-400 italic">no email on record</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border capitalize ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                  No members yet — the invited admin hasn&apos;t completed sign-up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

      {/* ── Field Definitions ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Custom Fields</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Define what data this company collects on each lead.
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm((v) => !v); setMsg(null) }}
            className="inline-flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 transition"
          >
            <PlusIcon className="w-4 h-4" /> Add field
          </button>
        </div>

        {msg && (
          <p className={msg.kind === 'ok'
            ? 'text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2'
            : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'}>
            {msg.text}
          </p>
        )}

        {/* Add field form */}
        {showAddForm && (
          <form onSubmit={submitAdd} className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-700">New field</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider">Label</label>
                <input
                  required value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Phone Number"
                  className="mt-0.5 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)}
                  className="mt-0.5 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 pb-1 cursor-pointer">
                <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded border-gray-300" />
                Required
              </label>
            </div>
            {newType === 'select' && (
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider">Options (comma-separated)</label>
                <input value={newOptions} onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="Option A, Option B, Option C"
                  className="mt-0.5 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md px-3 py-1.5 transition">
                Add field
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="border border-gray-200 text-sm rounded-md px-3 py-1.5 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Fields table */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Label</th>
                <th className="text-left px-3 py-2">Key</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Req.</th>
                <th className="text-left px-3 py-2">Active</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fields.map((f) =>
                editingId === f.id ? (
                  <tr key={f.id} className="bg-indigo-50/30">
                    <td colSpan={6} className="px-3 py-3">
                      <form onSubmit={(e) => submitEdit(e, f.id)} className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto_auto] gap-2 items-end">
                          <div>
                            <label className="text-[11px] text-gray-500">Label</label>
                            <input required value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                              className="mt-0.5 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500">Type</label>
                            <select value={editType} onChange={(e) => setEditType(e.target.value)}
                              className="mt-0.5 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <label className="flex items-center gap-1 text-sm text-gray-700 pb-1 cursor-pointer">
                            <input type="checkbox" checked={editRequired} onChange={(e) => setEditRequired(e.target.checked)} className="rounded border-gray-300" />
                            Req.
                          </label>
                          <label className="flex items-center gap-1 text-sm text-gray-700 pb-1 cursor-pointer">
                            <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="rounded border-gray-300" />
                            Active
                          </label>
                        </div>
                        {editType === 'select' && (
                          <div>
                            <label className="text-[11px] text-gray-500">Options (comma-separated)</label>
                            <input value={editOptions} onChange={(e) => setEditOptions(e.target.value)}
                              placeholder="Option A, Option B"
                              className="mt-0.5 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md px-3 py-1.5 transition">
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}
                            className="border border-gray-200 text-xs rounded-md px-3 py-1.5 hover:bg-gray-50">
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={f.id} className={`hover:bg-gray-50/60 ${!f.active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{f.label}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{f.key}</td>
                    <td className="px-3 py-2.5 text-gray-700 capitalize">{f.type}</td>
                    <td className="px-3 py-2.5 text-gray-700">{f.required ? '✓' : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border ${f.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {f.active ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(f)}
                          className="text-xs text-indigo-600 hover:text-indigo-800">
                          Edit
                        </button>
                        <button onClick={() => deleteField(f.id, f.label)} disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {fields.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                    No fields yet — click Add field above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Page Visibility ── */}
      <div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Page Visibility</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Control which sections are visible to this company&apos;s users.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 py-2 border-b border-gray-100 opacity-60">
              <input type="checkbox" checked disabled className="mt-0.5 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-800">Leads</p>
                <p className="text-xs text-gray-500">Core feature — always visible.</p>
              </div>
            </div>
            {FEATURE_LIST.map((f) => (
              <label key={f.key} className="flex items-start gap-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded">
                <input
                  type="checkbox"
                  checked={features[f.key]}
                  onChange={(e) => setFeatures((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                    {f.label}
                    {f.paid && (
                      <span className="text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded px-1 py-0.5">
                        Paid
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={saveFeatures}
            className={`w-full text-sm font-medium rounded-md px-3 py-2 transition ${featureSaved ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            {featureSaved ? 'Saved!' : 'Save visibility'}
          </button>
        </div>
      </div>

      </div>
    </div>
  )
}
