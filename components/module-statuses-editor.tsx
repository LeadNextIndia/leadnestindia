'use client'

import { useState } from 'react'
import type { ModuleStatus, StatusColor } from '@/lib/lead-modules'
import { LoadingSpinner } from '@/components/loading-spinner'

const COLOR_OPTIONS: { value: StatusColor; label: string; className: string }[] = [
  { value: 'gray',   label: 'Gray',   className: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'blue',   label: 'Blue',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'indigo', label: 'Indigo', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'amber',  label: 'Amber',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'green',  label: 'Green',  className: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'red',    label: 'Red',    className: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'purple', label: 'Purple', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'pink',   label: 'Pink',   className: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'teal',   label: 'Teal',   className: 'bg-teal-100 text-teal-700 border-teal-200' },
]

function slugifyKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

type Row = ModuleStatus

type Props = {
  moduleId: string
  initialStatuses: ModuleStatus[]
}

export function ModuleStatusesEditor({ moduleId, initialStatuses }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialStatuses.length > 0
      ? initialStatuses
      : [
          {
            id: 'new-1',
            key: 'new',
            label: 'New',
            color: 'blue',
            sortOrder: 0,
            isDefault: true,
            isTerminal: false,
          },
        ],
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
    setSaved(false)
  }

  function setDefault(idx: number) {
    setRows((prev) => prev.map((r, i) => ({ ...r, isDefault: i === idx })))
    setSaved(false)
  }

  function move(idx: number, direction: -1 | 1) {
    setRows((prev) => {
      const target = idx + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      return next.map((r, i) => ({ ...r, sortOrder: i }))
    })
    setSaved(false)
  }

  function remove(idx: number) {
    if (rows.length <= 1) {
      setError('At least one status is required.')
      return
    }
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      // If the removed one was default, promote the first.
      if (!next.some((r) => r.isDefault) && next.length > 0) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next.map((r, i) => ({ ...r, sortOrder: i }))
    })
    setSaved(false)
    setError(null)
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        key: '',
        label: '',
        color: 'gray',
        sortOrder: prev.length,
        isDefault: prev.length === 0,
        isTerminal: false,
      },
    ])
    setSaved(false)
  }

  async function save() {
    setError(null)
    setSaving(true)
    const payload = {
      statuses: rows.map((r, i) => ({
        key: r.key.trim(),
        label: r.label.trim(),
        color: r.color,
        sort_order: i,
        is_default: r.isDefault,
        is_terminal: r.isTerminal,
      })),
    }
    const res = await fetch(`/api/modules/${moduleId}/statuses`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(json.error ?? 'Save failed')
      return
    }
    setSaved(true)
  }

  const defaultIndex = rows.findIndex((r) => r.isDefault)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] divide-y divide-gray-100 dark:divide-[var(--border)]">
        {rows.map((r, i) => {
          const colorMeta = COLOR_OPTIONS.find((c) => c.value === r.color) ?? COLOR_OPTIONS[0]
          return (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex flex-col gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-xs px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  className="text-xs px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px] gap-3">
                <label className="text-xs">
                  <span className="text-gray-600 dark:text-gray-300">Label *</span>
                  <input
                    value={r.label}
                    onChange={(e) => {
                      const label = e.target.value
                      const patch: Partial<Row> = { label }
                      if (!r.key) patch.key = slugifyKey(label)
                      update(i, patch)
                    }}
                    placeholder="New"
                    className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-gray-600 dark:text-gray-300">Key (immutable once used)</span>
                  <input
                    value={r.key}
                    onChange={(e) => update(i, { key: slugifyKey(e.target.value) })}
                    placeholder="new"
                    className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)] font-mono"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-gray-600 dark:text-gray-300">Color</span>
                  <select
                    value={r.color}
                    onChange={(e) => update(i, { color: e.target.value as StatusColor })}
                    className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-1.5 items-end min-w-[120px]">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorMeta.className}`}
                >
                  {r.label || <em className="text-gray-400">preview</em>}
                </span>
                <label className="text-[11px] inline-flex items-center gap-1 text-gray-700 dark:text-gray-200 cursor-pointer">
                  <input
                    type="radio"
                    name="default-status"
                    checked={defaultIndex === i}
                    onChange={() => setDefault(i)}
                  />
                  Default
                </label>
                <label className="text-[11px] inline-flex items-center gap-1 text-gray-700 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.isTerminal}
                    onChange={(e) => update(i, { isTerminal: e.target.checked })}
                  />
                  Terminal
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-[11px] text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 text-sm border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
        >
          + Add status
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-1.5 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" className="text-white" />}
          {saving ? 'Saving…' : 'Save statuses'}
        </button>
        {saved && <span className="text-sm text-green-700 dark:text-green-400">Saved.</span>}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        <strong>Default:</strong> new records land here.{' '}
        <strong>Terminal:</strong> marks the pipeline as complete (won/lost equivalents).
        Existing records referring to a removed status key stay in place but render as a gray fallback badge.
      </p>
    </div>
  )
}
