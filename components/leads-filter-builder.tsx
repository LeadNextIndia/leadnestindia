'use client'

import { useMemo } from 'react'
import {
  BUILT_IN_FIELDS,
  OPERATOR_LABELS,
  operatorsForType,
  type FieldMeta,
  type FilterCondition,
  type FilterOperator,
  type LeadFilter,
} from '@/lib/filters'
import { TrashIcon, PlusIcon } from './icons'

type FieldDef = {
  key: string
  label: string
  type: string
  options: string[] | null
}

type Props = {
  filter: LeadFilter
  onChange: (f: LeadFilter) => void
  fieldDefs: FieldDef[]
}

function toFieldMeta(fd: FieldDef): FieldMeta {
  return {
    key: fd.key,
    label: fd.label,
    type: (fd.type as FieldMeta['type']) ?? 'text',
    options: fd.options ?? null,
  }
}

let nextId = 0
const genId = () => `c${++nextId}-${Date.now()}`

export function LeadsFilterBuilder({ filter, onChange, fieldDefs }: Props) {
  const allFields = useMemo<FieldMeta[]>(
    () => [...BUILT_IN_FIELDS, ...fieldDefs.map(toFieldMeta)],
    [fieldDefs],
  )
  const fieldByKey = useMemo(
    () => Object.fromEntries(allFields.map((f) => [f.key, f])) as Record<string, FieldMeta>,
    [allFields],
  )

  function addCondition() {
    const first = allFields[0]
    if (!first) return
    const ops = operatorsForType(first.type)
    const cond: FilterCondition = {
      id: genId(),
      field: first.key,
      op: ops[0],
      value: '',
    }
    onChange({ conditions: [...filter.conditions, cond] })
  }

  function updateCondition(id: string, patch: Partial<FilterCondition>) {
    onChange({
      conditions: filter.conditions.map((c) => {
        if (c.id !== id) return c
        const next = { ...c, ...patch }
        if (patch.field !== undefined) {
          const fm = fieldByKey[patch.field]
          const ops = fm ? operatorsForType(fm.type) : []
          if (!ops.includes(next.op)) next.op = ops[0]
          next.value = ''
        }
        return next
      }),
    })
  }

  function removeCondition(id: string) {
    onChange({ conditions: filter.conditions.filter((c) => c.id !== id) })
  }

  function clearAll() {
    onChange({ conditions: [] })
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-gray-50/50 dark:bg-[var(--surface-muted)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Advanced filter
          <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-gray-500 dark:text-gray-400">
            all conditions must match (AND)
          </span>
        </p>
        {filter.conditions.length > 0 && (
          <button
            onClick={clearAll}
            className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {filter.conditions.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No conditions. Click <em>Add condition</em> to filter by any field.
        </p>
      )}

      <div className="space-y-2">
        {filter.conditions.map((cond) => {
          const meta = fieldByKey[cond.field]
          const ops = meta ? operatorsForType(meta.type) : []
          return (
            <div key={cond.id} className="flex flex-wrap items-center gap-2">
              {/* Field */}
              <select
                value={cond.field}
                onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs"
              >
                {allFields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Operator */}
              <select
                value={cond.op}
                onChange={(e) => updateCondition(cond.id, { op: e.target.value as FilterOperator })}
                className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs"
              >
                {ops.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>

              {/* Value(s) */}
              <ConditionValueInput
                cond={cond}
                meta={meta}
                onChange={(v) => updateCondition(cond.id, { value: v })}
              />

              {/* Remove */}
              <button
                onClick={() => removeCondition(cond.id)}
                title="Remove condition"
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={addCondition}
        className="inline-flex items-center gap-1 text-xs bg-white dark:bg-[var(--surface)] border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
      >
        <PlusIcon className="w-3 h-3" /> Add condition
      </button>
    </div>
  )
}

function ConditionValueInput({
  cond,
  meta,
  onChange,
}: {
  cond: FilterCondition
  meta: FieldMeta | undefined
  onChange: (v: string | string[]) => void
}) {
  if (cond.op === 'is_empty' || cond.op === 'not_empty') return null

  const type = meta?.type ?? 'text'
  const stringValue = Array.isArray(cond.value) ? cond.value.join(',') : (cond.value ?? '')

  if (cond.op === 'between' && (type === 'date' || type === 'timestamp')) {
    const [lo, hi] = Array.isArray(cond.value)
      ? cond.value
      : String(cond.value ?? '').split(',')
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={lo ?? ''}
          onChange={(e) => onChange([e.target.value, hi ?? ''])}
          className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-400">and</span>
        <input
          type="date"
          value={hi ?? ''}
          onChange={(e) => onChange([lo ?? '', e.target.value])}
          className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs"
        />
      </div>
    )
  }

  if (type === 'timestamp' || type === 'date') {
    return (
      <input
        type="date"
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs"
      />
    )
  }

  if ((type === 'status' || type === 'select') && cond.op === 'in') {
    const selected = Array.isArray(cond.value)
      ? cond.value
      : String(cond.value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const opts = meta?.options ?? []
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {opts.map((o) => {
          const on = selected.includes(o)
          return (
            <button
              key={o}
              onClick={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
              className={`text-[11px] rounded-full border px-2 py-0.5 capitalize ${
                on
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-[var(--surface)] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[var(--border)]'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    )
  }

  if (type === 'status' || type === 'select') {
    const opts = meta?.options ?? []
    return (
      <select
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs"
      >
        <option value="">Select…</option>
        {opts.map((o) => (
          <option key={o} value={o} className="capitalize">
            {o}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      value={stringValue}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className="border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2 py-1 text-xs min-w-[140px]"
    />
  )
}
