// Shared filter model — used by the leads page (client-side apply)
// and the export API (server-side apply).

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'is_empty'
  | 'not_empty'
  | 'before'
  | 'after'
  | 'between'

export type FilterCondition = {
  id: string
  field: string
  op: FilterOperator
  value: string | string[] | null
}

export type LeadFilter = {
  conditions: FilterCondition[]
}

export type FieldMeta = {
  key: string
  label: string
  type: 'text' | 'number' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'status' | 'timestamp'
  options?: string[] | null
}

export const BUILT_IN_FIELDS: FieldMeta[] = [
  { key: 'status', label: 'Status', type: 'status', options: ['new', 'contacted', 'qualified', 'won', 'lost'] },
  { key: 'created_at', label: 'Created', type: 'timestamp' },
]

export function operatorsForType(type: FieldMeta['type']): FilterOperator[] {
  switch (type) {
    case 'status':
    case 'select':
      return ['equals', 'not_equals', 'in', 'is_empty', 'not_empty']
    case 'number':
      return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'not_empty']
    case 'timestamp':
    case 'date':
      return ['before', 'after', 'between', 'is_empty', 'not_empty']
    case 'text':
    case 'email':
    case 'tel':
    case 'textarea':
    default:
      return ['contains', 'not_contains', 'equals', 'not_equals', 'is_empty', 'not_empty']
  }
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'is one of',
  is_empty: 'is empty',
  not_empty: 'is not empty',
  before: 'is before',
  after: 'is after',
  between: 'is between',
}

// Row shape used in the leads page — subset that the evaluator needs.
export type EvalRow = {
  status: string | null
  created_at: string
  custom_data: Record<string, unknown> | null
}

function readField(row: EvalRow, field: string): unknown {
  if (field === 'status') return row.status ?? 'new'
  if (field === 'created_at') return row.created_at
  return row.custom_data?.[field]
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v))
  return Number.isFinite(n) ? n : null
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function tsMs(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const t = new Date(String(v)).getTime()
  return Number.isFinite(t) ? t : null
}

export function evalCondition(row: EvalRow, cond: FilterCondition): boolean {
  const raw = readField(row, cond.field)
  const value = cond.value

  switch (cond.op) {
    case 'is_empty':
      return raw === null || raw === undefined || raw === ''
    case 'not_empty':
      return !(raw === null || raw === undefined || raw === '')
    case 'equals':
      return toStr(raw).toLowerCase() === toStr(value).toLowerCase()
    case 'not_equals':
      return toStr(raw).toLowerCase() !== toStr(value).toLowerCase()
    case 'contains':
      return toStr(raw).toLowerCase().includes(toStr(value).toLowerCase())
    case 'not_contains':
      return !toStr(raw).toLowerCase().includes(toStr(value).toLowerCase())
    case 'in': {
      const arr = Array.isArray(value) ? value : toStr(value).split(',').map((s) => s.trim())
      return arr.map((s) => s.toLowerCase()).includes(toStr(raw).toLowerCase())
    }
    case 'gt':  { const a = toNum(raw), b = toNum(value); return a !== null && b !== null && a >  b }
    case 'gte': { const a = toNum(raw), b = toNum(value); return a !== null && b !== null && a >= b }
    case 'lt':  { const a = toNum(raw), b = toNum(value); return a !== null && b !== null && a <  b }
    case 'lte': { const a = toNum(raw), b = toNum(value); return a !== null && b !== null && a <= b }
    case 'before': { const a = tsMs(raw), b = tsMs(value); return a !== null && b !== null && a <  b }
    case 'after':  { const a = tsMs(raw), b = tsMs(value); return a !== null && b !== null && a >  b }
    case 'between': {
      const [lo, hi] = Array.isArray(value) ? value : toStr(value).split(',')
      const a = tsMs(raw), l = tsMs(lo), h = tsMs(hi)
      return a !== null && l !== null && h !== null && a >= l && a <= h
    }
    default:
      return true
  }
}

export function applyFilter<T extends EvalRow>(rows: T[], filter: LeadFilter): T[] {
  if (!filter.conditions.length) return rows
  return rows.filter((r) => filter.conditions.every((c) => evalCondition(r, c)))
}

export function isEmptyFilter(f: LeadFilter | null | undefined): boolean {
  return !f || !f.conditions || f.conditions.length === 0
}

export function serializeFilter(f: LeadFilter): string {
  return encodeURIComponent(JSON.stringify(f))
}

export function parseFilter(s: string | null): LeadFilter {
  if (!s) return { conditions: [] }
  try {
    const parsed = JSON.parse(decodeURIComponent(s))
    if (parsed && Array.isArray(parsed.conditions)) return parsed as LeadFilter
  } catch {
    // fall through
  }
  return { conditions: [] }
}
