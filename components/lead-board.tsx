'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { LeadsFilterBuilder } from './leads-filter-builder'
import { SavedViewsMenu, type SavedView } from './saved-views-menu'
import { applyFilter, isEmptyFilter, type LeadFilter } from '@/lib/filters'
import type { ModuleStatus, StatusColor } from '@/lib/lead-modules'
import type { FieldDef, Member } from './lead-edit-modal'
import { LeadEditModal, type EditableLead } from './lead-edit-modal'
import { LoadingSpinner } from './loading-spinner'

const STATUS_HEADER_CLASSES: Record<StatusColor, string> = {
  gray:   'bg-gray-100 text-gray-700 border-gray-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber:  'bg-amber-50 text-amber-700 border-amber-200',
  green:  'bg-green-50 text-green-700 border-green-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  pink:   'bg-pink-50 text-pink-700 border-pink-200',
  teal:   'bg-teal-50 text-teal-700 border-teal-200',
}

type Lead = EditableLead & { created_at: string }

type Props = {
  leads: Lead[]
  fieldDefs: FieldDef[]
  statuses: ModuleStatus[]
  members: Member[]
  currentUserId: string
  savedViews: SavedView[]
  showAnalytics: boolean
  showInvoicing: boolean
  showActivity: boolean
  canEdit: boolean
  moduleSingular: string
}

export function LeadBoard({
  leads: initialLeads,
  fieldDefs,
  statuses,
  members,
  currentUserId,
  savedViews: initialViews,
  showAnalytics,
  showInvoicing,
  showActivity,
  canEdit,
  moduleSingular,
}: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [dragError, setDragError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  // Assignee + search + advanced-filter state — mirrors LeadsTable so filters
  // are consistent across views (superadmin's saved views work on both).
  const [query, setQuery] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [advancedFilter, setAdvancedFilter] = useState<LeadFilter>({ conditions: [] })
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedView[]>(initialViews)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const emailByUser = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.email ?? m.user_id.slice(0, 8)])),
    [members],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const afterAdvanced = applyFilter(leads, advancedFilter)
    return afterAdvanced.filter((l) => {
      if (assigneeFilter === 'mine' && l.assigned_to !== currentUserId) return false
      if (assigneeFilter === 'unassigned' && l.assigned_to) return false
      if (!q) return true
      return JSON.stringify(l.custom_data ?? {}).toLowerCase().includes(q)
    })
  }, [leads, query, assigneeFilter, advancedFilter, currentUserId])

  const byStatus = useMemo(() => {
    const map = new Map<string, Lead[]>()
    for (const s of statuses) map.set(s.key, [])
    // Bucket by exact key; anything unknown lands in a synthetic "_orphan" column
    // to keep old data visible after a superadmin status rename.
    const orphans: Lead[] = []
    for (const l of filtered) {
      const key = (l.status ?? '').toLowerCase()
      const bucket = map.get(key)
      if (bucket) bucket.push(l)
      else orphans.push(l)
    }
    return { map, orphans }
  }, [filtered, statuses])

  // Primary display field: first field in the resolved module config.
  const [primaryField, ...secondaryFields] = fieldDefs
  const secondary = secondaryFields.slice(0, 2)

  async function moveCard(leadId: string, toStatus: string) {
    const before = leads.find((l) => l.id === leadId)
    if (!before || before.status === toStatus) return
    setDragError(null)
    setPendingId(leadId)

    // Optimistic: update local state immediately.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: toStatus } : l)))

    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: toStatus }),
    })
    setPendingId(null)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setDragError(json.error ?? 'Failed to update status')
      // Roll back
      setLeads((prev) => prev.map((l) => (l.id === leadId ? before : l)))
      return
    }
    router.refresh()
  }

  function onDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCardId(null)
    const { active, over } = event
    if (!over) return
    const leadId = String(active.id)
    const columnKey = String(over.id).replace(/^col:/, '')
    if (!statuses.some((s) => s.key === columnKey)) return
    moveCard(leadId, columnKey)
  }

  const activeCard = activeCardId ? leads.find((l) => l.id === activeCardId) ?? null : null

  return (
    <>
      {/* Toolbar row 1: search + saved views + advanced filter */}
      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-[var(--border)] rounded-md bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          {showAnalytics && (
            <button
              onClick={() => setShowFilterBuilder((v) => !v)}
              className={`text-xs rounded-md px-2.5 py-1 border transition ${
                showFilterBuilder || !isEmptyFilter(advancedFilter)
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'bg-white dark:bg-[var(--surface)] border-gray-200 dark:border-[var(--border)] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]'
              }`}
            >
              {isEmptyFilter(advancedFilter)
                ? 'Filter'
                : `Filter · ${advancedFilter.conditions.length}`}
            </button>
          )}
          <div className="ml-auto flex items-center gap-1 flex-wrap">
            {(['all', 'mine', 'unassigned'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setAssigneeFilter(v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${
                  assigneeFilter === v
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-[var(--surface)] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]'
                }`}
              >
                {v === 'all' ? 'Everyone' : v === 'mine' ? `My ${moduleSingular.toLowerCase()}s` : 'Unassigned'}
              </button>
            ))}
          </div>
        </div>

        {showAnalytics && showFilterBuilder && (
          <div className="pt-2 border-t border-gray-100 dark:border-[var(--border)]">
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

        {dragError && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {dragError}
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-3 items-start">
          {statuses.map((s) => {
            const bucket = byStatus.map.get(s.key) ?? []
            return (
              <Column key={s.key} status={s} count={bucket.length}>
                {bucket.map((l) => (
                  <Card
                    key={l.id}
                    lead={l}
                    pending={pendingId === l.id}
                    primaryLabel={primaryLabel(l, primaryField, moduleSingular)}
                    secondary={secondary.map((f) => ({
                      label: f.label,
                      value: String((l.custom_data as Record<string, unknown> | null)?.[f.key] ?? '—'),
                    }))}
                    assignee={l.assigned_to ? emailByUser.get(l.assigned_to) ?? null : null}
                    followUp={l.follow_up_at}
                    onClick={canEdit ? () => setEditingLead(l) : undefined}
                  />
                ))}
                {bucket.length === 0 && (
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-6 border border-dashed border-gray-200 dark:border-[var(--border)] rounded-md">
                    Drop here
                  </div>
                )}
              </Column>
            )
          })}

          {byStatus.orphans.length > 0 && (
            <div className="w-72 flex-shrink-0">
              <div className="rounded-t-lg border border-gray-200 dark:border-[var(--border)] bg-gray-100 dark:bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                Orphaned ({byStatus.orphans.length})
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                  Status no longer defined — drag to a valid column.
                </div>
              </div>
              <div className="border border-t-0 border-gray-200 dark:border-[var(--border)] rounded-b-lg p-2 space-y-2 bg-gray-50 dark:bg-[var(--background)]">
                {byStatus.orphans.map((l) => (
                  <Card
                    key={l.id}
                    lead={l}
                    pending={pendingId === l.id}
                    primaryLabel={primaryLabel(l, primaryField, moduleSingular)}
                    secondary={secondary.map((f) => ({
                      label: f.label,
                      value: String((l.custom_data as Record<string, unknown> | null)?.[f.key] ?? '—'),
                    }))}
                    assignee={l.assigned_to ? emailByUser.get(l.assigned_to) ?? null : null}
                    followUp={l.follow_up_at}
                    onClick={canEdit ? () => setEditingLead(l) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="rounded-md border border-indigo-300 bg-white dark:bg-[var(--surface)] shadow-lg px-3 py-2 text-xs opacity-90 w-64">
              {primaryLabel(activeCard, primaryField, moduleSingular)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          fieldDefs={fieldDefs}
          members={members}
          statuses={statuses}
          onClose={() => setEditingLead(null)}
          invoicingEnabled={showInvoicing}
          activityEnabled={showActivity}
        />
      )}
    </>
  )
}

function primaryLabel(lead: Lead, primary: FieldDef | undefined, fallback: string): string {
  if (primary) {
    const v = (lead.custom_data as Record<string, unknown> | null)?.[primary.key]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return `Untitled ${fallback.toLowerCase()}`
}

function Column({
  status,
  count,
  children,
}: {
  status: ModuleStatus
  count: number
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${status.key}` })
  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div
        className={`rounded-t-2xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between ${STATUS_HEADER_CLASSES[status.color]}`}
      >
        <span>{status.label}</span>
        <span className="text-[10px] uppercase tracking-wider bg-white/60 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`border border-t-0 rounded-b-2xl p-2 space-y-2 min-h-[80px] transition-all duration-200 ${
          isOver
            ? 'border-indigo-400 bg-indigo-50/70 dark:bg-indigo-500/10 ring-2 ring-indigo-300/40 ring-offset-0'
            : 'border-gray-200/70 dark:border-[var(--border)] bg-white/40 dark:bg-[var(--background)] backdrop-blur-sm'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function Card({
  lead,
  primaryLabel,
  secondary,
  assignee,
  followUp,
  pending,
  onClick,
}: {
  lead: Lead
  primaryLabel: string
  secondary: Array<{ label: string; value: string }>
  assignee: string | null
  followUp: string | null
  pending: boolean
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-gray-200/80 bg-white dark:bg-[var(--surface)] p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${
        isDragging ? 'opacity-40' : 'opacity-100'
      } ${pending ? 'ring-2 ring-indigo-300' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Drag card"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 -ml-0.5 mt-0.5"
          {...attributes}
          {...listeners}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden>
            <circle cx="2.5" cy="2"  r="1.2" fill="currentColor" />
            <circle cx="7.5" cy="2"  r="1.2" fill="currentColor" />
            <circle cx="2.5" cy="7"  r="1.2" fill="currentColor" />
            <circle cx="7.5" cy="7"  r="1.2" fill="currentColor" />
            <circle cx="2.5" cy="12" r="1.2" fill="currentColor" />
            <circle cx="7.5" cy="12" r="1.2" fill="currentColor" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 text-left truncate w-full disabled:cursor-default"
          >
            {primaryLabel}
          </button>
          {secondary.map((s, i) => (
            <div key={i} className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              <span className="text-gray-400 dark:text-gray-500">{s.label}:</span> {s.value}
            </div>
          ))}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            {assignee && (
              <span className="inline-flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-7 8-7s8 3 8 7"/></svg>
                <span className="truncate max-w-[110px]">{assignee}</span>
              </span>
            )}
            {followUp && (
              <span className="inline-flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4"/></svg>
                {new Date(followUp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {pending && <LoadingSpinner size="sm" />}
          </div>
        </div>
      </div>
    </div>
  )
}
