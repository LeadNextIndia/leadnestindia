'use client'

import { useEffect, useRef, useState } from 'react'

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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value === null) setSelected(new Set(options.map((o) => o.key)))
    else setSelected(new Set(value))
  }, [value, options])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function save() {
    const visible = options.filter((o) => selected.has(o.key)).map((o) => o.key)
    setSaving(true)
    const res = await fetch('/api/user-prefs/columns', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ view_key: viewKey, visible_fields: visible }),
    })
    setSaving(false)
    if (res.ok) {
      onChange(visible.length === options.length ? null : visible)
      setOpen(false)
    }
  }

  function resetAll() {
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
        <div className="absolute right-0 mt-1 z-30 w-64 rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-[var(--border)] flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Visible columns</div>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={resetAll}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-gray-500 dark:text-gray-400 hover:underline"
              >
                None
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                No custom fields configured
              </div>
            )}
            {options.map((o) => (
              <label
                key={o.key}
                className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.key)}
                  onChange={() => toggle(o.key)}
                  className="rounded border-gray-300 dark:border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700 dark:text-gray-200 capitalize">
                  {o.label}
                </span>
              </label>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-gray-100 dark:border-[var(--border)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-[var(--border)] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-xs px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
