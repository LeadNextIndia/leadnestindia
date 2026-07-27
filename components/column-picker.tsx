'use client'

import { useEffect, useMemo, useState } from 'react'

type Option = { key: string; label: string }

export function ColumnPicker({
  viewKey,
  options,
  value,
  onChange,
}: {
  viewKey: string
  options: Option[]
  value: string[] | null // null = "show all"
  onChange: (visible: string[] | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(value ?? options.map((o) => o.key))
  )
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  useEffect(() => {
    setSelected(new Set(value ?? options.map((o) => o.key)))
  }, [value, options])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  // Detect fields that share the same label — these look "duplicate" in the table
  const labelCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of options) m.set(o.label.trim().toLowerCase(), (m.get(o.label.trim().toLowerCase()) ?? 0) + 1)
    return m
  }, [options])

  async function save() {
    const visible = options.filter((o) => selected.has(o.key)).map((o) => o.key)
    setSaving(true)
    setSaveErr(null)
    const res = await fetch('/api/user-prefs/columns', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ view_key: viewKey, visible_fields: visible }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setSaveErr(json.error ?? 'Save failed')
      return
    }
    // If everything selected, we persist as null so future field additions show automatically
    onChange(visible.length === options.length ? null : visible)
    setOpen(false)
  }

  function selectAll() {
    setSelected(new Set(options.map((o) => o.key)))
  }
  function clearAll() {
    setSelected(new Set())
  }
  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  const hiddenCount = options.length - selected.size

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        Columns
        {hiddenCount > 0 && (
          <span className="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded px-1">
            {hiddenCount} hidden
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="column-picker-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[var(--surface)] rounded-xl shadow-2xl border border-gray-200 dark:border-[var(--border)] overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-[var(--border)]">
              <div>
                <h2 id="column-picker-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Choose columns to show
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Your selection is saved and applied next time you visit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 -mt-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 dark:border-[var(--border)] flex items-center justify-between text-xs">
              <div className="text-gray-600 dark:text-gray-300">
                <strong>{selected.size}</strong> of <strong>{options.length}</strong> selected
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1 px-1">
              {options.length === 0 && (
                <div className="px-3 py-8 text-xs text-gray-500 dark:text-gray-400 text-center">
                  No custom fields configured for this store.
                </div>
              )}
              {options.map((o) => {
                const isDup = (labelCount.get(o.label.trim().toLowerCase()) ?? 0) > 1
                return (
                  <label
                    key={o.key}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(o.key)}
                      onChange={() => toggle(o.key)}
                      className="rounded border-gray-300 dark:border-[var(--border)] text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 dark:text-gray-100 capitalize truncate">
                          {o.label}
                        </span>
                        {isDup && (
                          <span
                            className="text-[9px] uppercase tracking-widest bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded px-1 py-0.5"
                            title="Another field has the same label. Uncheck one to remove the duplicate column."
                          >
                            Dup
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">
                        {o.key}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            {saveErr && (
              <p className="px-5 pt-2 text-xs text-red-700 dark:text-red-300">
                {saveErr}
              </p>
            )}

            <div className="px-5 py-3 border-t border-gray-200 dark:border-[var(--border)] flex justify-end gap-2 bg-gray-50/50 dark:bg-[var(--surface-muted)]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-[var(--border)] text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[var(--surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
