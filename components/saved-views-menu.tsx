'use client'

import { useState } from 'react'
import { isEmptyFilter, type LeadFilter } from '@/lib/filters'

export type SavedView = {
  id: string
  name: string
  filter: LeadFilter
  created_at: string
}

type Props = {
  views: SavedView[]
  onViewsChange: (v: SavedView[]) => void
  currentFilter: LeadFilter
  onApply: (f: LeadFilter) => void
  activeViewId: string | null
  onActiveViewIdChange: (id: string | null) => void
}

export function SavedViewsMenu({
  views,
  onViewsChange,
  currentFilter,
  onApply,
  activeViewId,
  onActiveViewIdChange,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setErr(null)
    if (!name.trim()) {
      setErr('Give this view a name.')
      return
    }
    setBusy(true)
    const res = await fetch('/api/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), filter: currentFilter }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setErr(data.error ?? 'Could not save view.')
      return
    }
    onViewsChange([data as SavedView, ...views])
    onActiveViewIdChange(data.id)
    setName('')
    setSaveOpen(false)
  }

  async function remove(id: string) {
    if (!confirm('Delete this saved view?')) return
    const res = await fetch(`/api/saved-views/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    onViewsChange(views.filter((v) => v.id !== id))
    if (activeViewId === id) onActiveViewIdChange(null)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeViewId ?? ''}
        onChange={(e) => {
          const id = e.target.value
          if (!id) {
            onActiveViewIdChange(null)
            onApply({ conditions: [] })
            return
          }
          const v = views.find((x) => x.id === id)
          if (v) {
            onActiveViewIdChange(id)
            onApply(v.filter)
          }
        }}
        className="text-xs border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1"
      >
        <option value="">All leads</option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <button
        onClick={() => {
          setSaveOpen(true)
          setName('')
          setErr(null)
        }}
        disabled={isEmptyFilter(currentFilter)}
        title={isEmptyFilter(currentFilter) ? 'Add a filter condition first' : 'Save current filter as a view'}
        className="text-xs border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save view
      </button>

      {activeViewId && (
        <button
          onClick={() => remove(activeViewId)}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Delete view
        </button>
      )}

      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setSaveOpen(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[var(--surface)] rounded-xl shadow-xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Save view</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Saves your current filter. Only you can see this view.
              </p>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Hot leads this month"'
              className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
            />
            {err && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md px-2 py-1">
                {err}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSaveOpen(false)}
                className="text-xs border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
