'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/loading-spinner'

export type EditorField = {
  fieldId: string
  key: string
  catalogLabel: string
  type: string
  catalogRequired: boolean
  included: boolean
  labelOverride: string
  requiredOverride: boolean | null
  sortOrder: number
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

type Props = {
  tenantId: string
  moduleId: string
  initialFields: EditorField[]
}

export function ModuleFieldsEditor({ tenantId, moduleId, initialFields }: Props) {
  const router = useRouter()
  const [fields, setFields] = useState<EditorField[]>(initialFields)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showNewField, setShowNewField] = useState(false)
  const [creating, setCreating] = useState(false)

  function updateField(fieldId: string, patch: Partial<EditorField>) {
    setFields((prev) => prev.map((f) => (f.fieldId === fieldId ? { ...f, ...patch } : f)))
    setSaved(false)
  }

  function move(fieldId: string, direction: -1 | 1) {
    setFields((prev) => {
      const included = prev.filter((f) => f.included)
      const idx = included.findIndex((f) => f.fieldId === fieldId)
      const target = idx + direction
      if (idx < 0 || target < 0 || target >= included.length) return prev
      const [item] = included.splice(idx, 1)
      included.splice(target, 0, item)
      // Re-number sort_order for included fields.
      const bySortOrder = new Map(included.map((f, i) => [f.fieldId, i]))
      return prev.map((f) =>
        bySortOrder.has(f.fieldId)
          ? { ...f, sortOrder: bySortOrder.get(f.fieldId)! }
          : f,
      )
    })
    setSaved(false)
  }

  async function createCatalogField(
    label: string,
    type: string,
    required: boolean,
    options: string[] | null,
  ) {
    setCreating(true)
    setError(null)
    const body: Record<string, unknown> = { label, type, required }
    if (type === 'select') body.options = options
    const res = await fetch(`/api/superadmin/tenant/${tenantId}/fields`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok) {
      setError(json.error ?? 'Failed to create field.')
      return
    }
    // Push the new field into local state as included in this module.
    const included = fields.filter((f) => f.included)
    setFields((prev) => [
      ...prev,
      {
        fieldId: json.id,
        key: json.key,
        catalogLabel: json.label,
        type: json.type,
        catalogRequired: !!json.required,
        included: true,
        labelOverride: '',
        requiredOverride: null,
        sortOrder: included.length,
      },
    ])
    setShowNewField(false)
    setSaved(false)
    // Refresh so the superadmin tenant page's Custom Fields section picks up the new row.
    router.refresh()
  }

  async function save() {
    setSaving(true)
    setError(null)
    const payload = {
      fields: fields
        .filter((f) => f.included)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f, i) => ({
          field_id: f.fieldId,
          label_override: f.labelOverride.trim() || null,
          required_override: f.requiredOverride,
          visible: true,
          sort_order: i,
        })),
    }
    const res = await fetch(`/api/modules/${moduleId}/fields`, {
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

  const included = fields.filter((f) => f.included).sort((a, b) => a.sortOrder - b.sortOrder)
  const available = fields.filter((f) => !f.included)

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--border)] text-sm font-semibold text-gray-900 dark:text-gray-100">
          In this module ({included.length})
        </div>
        {included.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            No fields in this module yet. Toggle one on below.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-[var(--border)]">
            {included.map((f, i) => (
              <li key={f.fieldId} className="px-4 py-3 flex items-start gap-3">
                <div className="flex flex-col gap-1 mt-0.5">
                  <button
                    type="button"
                    onClick={() => move(f.fieldId, -1)}
                    disabled={i === 0}
                    className="text-xs px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(f.fieldId, 1)}
                    disabled={i === included.length - 1}
                    className="text-xs px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <code className="font-mono text-[10px] bg-gray-100 dark:bg-[var(--surface-muted)] rounded px-1 py-0.5">
                      {f.key}
                    </code>
                    <span className="uppercase tracking-wider">{f.type}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-2 items-center">
                    <label className="text-xs">
                      <span className="text-gray-600 dark:text-gray-300">
                        Label (default: <em>{f.catalogLabel}</em>)
                      </span>
                      <input
                        value={f.labelOverride}
                        onChange={(e) => updateField(f.fieldId, { labelOverride: e.target.value })}
                        placeholder={f.catalogLabel}
                        className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={f.requiredOverride ?? f.catalogRequired}
                        onChange={(e) =>
                          updateField(f.fieldId, { requiredOverride: e.target.checked })
                        }
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      Required
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateField(f.fieldId, { included: false })}
                  className="text-xs text-gray-500 hover:text-red-600"
                  title="Remove from module"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--border)] flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Available in catalog ({available.length})
          </div>
          <button
            type="button"
            onClick={() => setShowNewField((v) => !v)}
            className="text-xs border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
          >
            {showNewField ? 'Cancel' : '+ New field'}
          </button>
        </div>

        {showNewField && (
          <NewFieldForm
            creating={creating}
            onCancel={() => setShowNewField(false)}
            onSubmit={createCatalogField}
          />
        )}

        {available.length === 0 && !showNewField ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            Every catalog field is in this module. Click <strong>+ New field</strong> to add one
            to the catalog and this module at the same time.
          </div>
        ) : available.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-[var(--border)]">
            {available.map((f) => (
              <li key={f.fieldId} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100">{f.catalogLabel}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{f.key}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateField(f.fieldId, {
                      included: true,
                      sortOrder: included.length,
                    })
                  }
                  className="text-xs border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" className="text-white" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && (
          <span className="text-sm text-green-700 dark:text-green-400">Saved.</span>
        )}
      </div>
    </div>
  )
}

function NewFieldForm({
  creating,
  onCancel,
  onSubmit,
}: {
  creating: boolean
  onCancel: () => void
  onSubmit: (label: string, type: string, required: boolean, options: string[] | null) => void
}) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  const [required, setRequired] = useState(false)
  const [optionsText, setOptionsText] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const options =
      type === 'select'
        ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    onSubmit(label.trim(), type, required, options)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 border-b border-gray-100 dark:border-[var(--border)] bg-indigo-50/40 dark:bg-indigo-500/10 space-y-3"
    >
      <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
        New field — added to the tenant&apos;s catalog and to this module in one step.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2 items-end">
        <label className="text-xs">
          <span className="text-gray-600 dark:text-gray-300">Label *</span>
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Preferred Contact Time"
            className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
          />
        </label>
        <label className="text-xs">
          <span className="text-gray-600 dark:text-gray-300">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs inline-flex items-center gap-1.5 pb-1.5">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded border-gray-300"
          />
          Required
        </label>
      </div>
      {type === 'select' && (
        <label className="text-xs block">
          <span className="text-gray-600 dark:text-gray-300">Options (comma-separated)</span>
          <input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="Option A, Option B, Option C"
            className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
          />
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={creating || !label.trim()}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {creating && <LoadingSpinner size="sm" className="text-white" />}
          {creating ? 'Creating…' : 'Create field'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[var(--surface)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
