'use client'

import { useMemo, useState } from 'react'
import { SearchIcon, PencilIcon, DownloadIcon } from './icons'
import { cn } from '@/lib/utils'
import { LeadsFilterBuilder } from './leads-filter-builder'
import { SavedViewsMenu, type SavedView } from './saved-views-menu'
import { applyFilter, isEmptyFilter, serializeFilter, type LeadFilter } from '@/lib/filters'
import { LeadEditModal, type EditableLead, type Member, type FieldDef } from './lead-edit-modal'
import { ColumnPicker } from './column-picker'

type Lead = EditableLead & {
  created_at: string
}

type Props = {
  leads: Lead[]
  columns: string[]
  fieldDefs: FieldDef[]
  canEdit: boolean
  savedViews: SavedView[]
  showAnalytics: boolean
  showExport: boolean
  showInvoicing: boolean
  showActivity: boolean
  members: Member[]
  currentUserId: string | null
  initialVisibleColumns?: string[] | null
  manageFieldsHref?: string
  /** view_key for column preference persistence (per module). Default: 'leads'. */
  columnViewKey?: string
  /** Base URL for CSV export (module-scoped). Default: '/api/export'. */
  exportHrefBase?: string
}

const statusStyles: Record<string, string> = {
  new:       'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  won:       'bg-green-50 text-green-700 border-green-200',
  lost:      'bg-red-50 text-red-700 border-red-200',
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (status ?? 'new').toLowerCase()
  const cls = statusStyles[key] ?? 'bg-gray-50 text-gray-700 border-gray-200'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', cls)}>
      {status ?? 'new'}
    </span>
  )
}

function startOfDayMs(d = new Date()): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function FollowUpBadge({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const ms = new Date(iso).getTime()
  const today = startOfDayMs()
  const tomorrow = today + 24 * 3600 * 1000
  let cls = 'bg-gray-50 text-gray-700 border-gray-200'
  let label = new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  if (ms < today) {
    cls = 'bg-red-50 text-red-700 border-red-200'
    label = `Overdue · ${label}`
  } else if (ms < tomorrow) {
    cls = 'bg-amber-50 text-amber-700 border-amber-200'
    label = `Today`
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {label}
    </span>
  )
}

export function LeadsTable({
  leads,
  columns,
  fieldDefs,
  canEdit,
  savedViews: initialViews,
  showAnalytics,
  showExport,
  showInvoicing,
  showActivity,
  members,
  currentUserId,
  initialVisibleColumns,
  manageFieldsHref,
  columnViewKey = 'leads',
  exportHrefBase = '/api/export',
}: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [visibleColumnPref, setVisibleColumnPref] = useState<string[] | null>(
    initialVisibleColumns ?? null
  )

  const visibleColumns = useMemo(() => {
    if (!visibleColumnPref) return columns
    const allow = new Set(visibleColumnPref)
    return columns.filter((c) => allow.has(c))
  }, [columns, visibleColumnPref])

  const columnPickerOptions = useMemo(() => {
    const labelByKey = new Map(fieldDefs.map((f) => [f.key, f.label]))
    return columns.map((k) => ({ key: k, label: labelByKey.get(k) ?? k }))
  }, [columns, fieldDefs])

  const [advancedFilter, setAdvancedFilter] = useState<LeadFilter>({ conditions: [] })
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedView[]>(initialViews)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const emailByUser = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.email ?? m.user_id.slice(0, 8)])),
    [members],
  )

  const statuses = useMemo(() => {
    const s = new Set<string>()
    leads.forEach((l) => s.add((l.status ?? 'new').toLowerCase()))
    return ['all', ...Array.from(s)]
  }, [leads])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const afterAdvanced = applyFilter(leads, advancedFilter)
    return afterAdvanced.filter((l) => {
      if (statusFilter !== 'all' && (l.status ?? 'new').toLowerCase() !== statusFilter) return false
      if (assigneeFilter === 'mine' && l.assigned_to !== currentUserId) return false
      if (assigneeFilter === 'unassigned' && l.assigned_to) return false
      if (!q) return true
      const hay = JSON.stringify(l.custom_data ?? {}).toLowerCase()
      return hay.includes(q)
    })
  }, [leads, query, statusFilter, assigneeFilter, advancedFilter, currentUserId])

  const exportHref = (() => {
    if (isEmptyFilter(advancedFilter)) return exportHrefBase
    const sep = exportHrefBase.includes('?') ? '&' : '?'
    return `${exportHrefBase}${sep}filter=${serializeFilter(advancedFilter)}`
  })()

  return (
    <>
      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden">
        {/* Toolbar row 1: search, saved views, actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-[var(--border)] bg-gray-50/50 dark:bg-[var(--surface-muted)]">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-[var(--border)] rounded-md bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {showAnalytics && (
            <SavedViewsMenu
              views={savedViews}
              onViewsChange={setSavedViews}
              currentFilter={advancedFilter}
              onApply={(f) => setAdvancedFilter(f)}
              activeViewId={activeViewId}
              onActiveViewIdChange={setActiveViewId}
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            {showAnalytics && (
              <>
                <button
                  onClick={() => setShowFilterBuilder((v) => !v)}
                  className={cn(
                    'text-xs rounded-md px-2.5 py-1 border transition',
                    showFilterBuilder || !isEmptyFilter(advancedFilter)
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-white dark:bg-[var(--surface)] border-gray-200 dark:border-[var(--border)] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]',
                  )}
                >
                  {isEmptyFilter(advancedFilter)
                    ? 'Filter'
                    : `Filter · ${advancedFilter.conditions.length}`}
                </button>
              </>
            )}
            {showExport && (
              <a
                href={exportHref}
                className="inline-flex items-center gap-1 text-xs border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
                title={isEmptyFilter(advancedFilter) ? 'Export all leads' : 'Export filtered leads'}
              >
                <DownloadIcon className="w-3.5 h-3.5" /> Export
              </a>
            )}
          </div>
        </div>

        {/* Advanced filter panel */}
        {showAnalytics && showFilterBuilder && (
          <div className="px-3 py-2 border-b border-gray-200 dark:border-[var(--border)]">
            <LeadsFilterBuilder
              filter={advancedFilter}
              onChange={(f) => {
                setAdvancedFilter(f)
                setActiveViewId(null)
              }}
              fieldDefs={fieldDefs}
            />
          </div>
        )}

        {/* Toolbar row 2: quick status + assignee filter pills */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-[var(--border)] bg-gray-50/30 dark:bg-[var(--surface-muted)]">
          <div className="flex items-center gap-1 flex-wrap">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-2.5 py-1 text-xs rounded-md border transition capitalize',
                  statusFilter === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-[var(--surface)] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]')}>
                {s}
              </button>
            ))}
          </div>
          {currentUserId && (
            <div className="flex items-center gap-1 flex-wrap sm:border-l sm:border-gray-200 dark:sm:border-[var(--border)] sm:pl-2 sm:ml-2">
              {(['all', 'mine', 'unassigned'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAssigneeFilter(v)}
                  className={cn('px-2.5 py-1 text-xs rounded-md border transition',
                    assigneeFilter === v
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-[var(--surface)] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]')}>
                  {v === 'all' ? 'Everyone' : v === 'mine' ? 'My leads' : 'Unassigned'}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} of {leads.length}</span>
            <ColumnPicker
              viewKey={columnViewKey}
              options={columnPickerOptions}
              value={visibleColumnPref}
              onChange={setVisibleColumnPref}
              manageFieldsHref={manageFieldsHref}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[var(--border)] bg-gray-50/50 dark:bg-[var(--surface-muted)] text-gray-600 dark:text-gray-300">
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Created</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Status</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Assigned</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Follow-up</th>
                {visibleColumns.map((c) => {
                  const label = fieldDefs.find((f) => f.key === c)?.label ?? c.replace(/_/g, ' ')
                  return (
                    <th key={c} className="text-left font-medium px-3 py-2 whitespace-nowrap">{label}</th>
                  )
                })}
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 dark:border-[var(--border)] hover:bg-gray-50/70 dark:hover:bg-[var(--surface-muted)]">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(l.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300 text-xs">
                    {l.assigned_to
                      ? (emailByUser.get(l.assigned_to) ?? l.assigned_to.slice(0, 8))
                      : <span className="text-gray-400 dark:text-gray-500">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <FollowUpBadge iso={l.follow_up_at} />
                  </td>
                  {visibleColumns.map((c) => (
                    <td key={c} className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                      {String((l.custom_data as Record<string, unknown> | null)?.[c] ?? '—')}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditingLead(l)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                        <PencilIcon className="w-3.5 h-3.5" /> Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + (canEdit ? 5 : 4)} className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    {leads.length === 0 ? 'No leads yet — click New Lead to add one.' : 'No leads match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          fieldDefs={fieldDefs}
          members={members}
          onClose={() => setEditingLead(null)}
          invoicingEnabled={showInvoicing}
          activityEnabled={showActivity}
        />
      )}
    </>
  )
}
