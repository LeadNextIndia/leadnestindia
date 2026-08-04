'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ModuleSummary } from '@/lib/lead-modules'
import { slugify } from '@/lib/lead-modules'
import { LoadingSpinner } from '@/components/loading-spinner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = {
  /** Superadmin context: which tenant we're editing modules for. */
  tenantId: string
  initialModules: ModuleSummary[]
}

export function ModulesAdminClient({ tenantId, initialModules }: Props) {
  const router = useRouter()
  const [modules, setModules] = useState<ModuleSummary[]>(initialModules)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // id being mutated, or 'create'
  const [reordering, setReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = modules.findIndex((m) => m.id === active.id)
    const newIndex = modules.findIndex((m) => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(modules, oldIndex, newIndex).map((m, i) => ({
      ...m,
      sortOrder: i,
    }))
    setModules(next)
    setReordering(true)
    setError(null)

    const res = await fetch('/api/modules/reorder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, ids: next.map((m) => m.id) }),
    })
    setReordering(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Reorder failed')
      // Roll back on failure so local state matches the server.
      setModules(modules)
      return
    }
    router.refresh()
  }

  async function saveEdit(id: string, singular: string, plural: string) {
    setError(null)
    setBusy(id)
    const res = await fetch(`/api/modules/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ singular, plural }),
    })
    const json = await res.json()
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? 'Save failed')
      return
    }
    setModules((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, singular: json.singular, plural: json.plural } : m,
      ),
    )
    setEditingId(null)
    router.refresh()
  }

  async function toggleActive(id: string, next: boolean) {
    setError(null)
    setBusy(id)
    const res = await fetch(`/api/modules/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: next }),
    })
    const json = await res.json()
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? 'Update failed')
      return
    }
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, active: !!json.active } : m)))
    router.refresh()
  }

  async function createModule(singular: string, plural: string, slugInput: string) {
    setError(null)
    setBusy('create')
    const slug = slugify(slugInput || singular)
    const res = await fetch('/api/modules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, singular, plural, slug }),
    })
    const json = await res.json()
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? 'Create failed')
      return
    }
    setModules((prev) => [
      ...prev,
      {
        id: json.id,
        slug: json.slug,
        singular: json.singular,
        plural: json.plural,
        icon: json.icon ?? null,
        sortOrder: json.sort_order ?? prev.length,
        isDefault: !!json.is_default,
        active: json.active !== false,
      },
    ])
    setCreating(false)
    router.refresh()
  }

  async function deleteModule(id: string) {
    if (!confirm('Delete this module? Leads on it must be reassigned first.')) return
    setError(null)
    setBusy(id)
    const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? 'Delete failed')
      return
    }
    setModules((prev) => prev.filter((m) => m.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Drag the handle on the left of each row to reorder the tenant&apos;s sidebar menu.
      </p>
      {reordering && (
        <div className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-2">
          <LoadingSpinner size="sm" /> Saving new order…
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] divide-y divide-gray-100 dark:divide-[var(--border)]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {modules.map((m) => (
              <SortableModuleRow
                key={m.id}
                tenantId={tenantId}
                module={m}
                editing={editingId === m.id}
                busy={busy === m.id}
                onEditStart={() => setEditingId(m.id)}
                onEditCancel={() => setEditingId(null)}
                onSave={(s, p) => saveEdit(m.id, s, p)}
                onToggleActive={(next) => toggleActive(m.id, next)}
                onDelete={() => deleteModule(m.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {modules.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            No modules yet. Run the phase9 migration to seed the default module.
          </div>
        )}
      </div>

      {creating ? (
        <CreateForm
          creating={busy === 'create'}
          onCancel={() => setCreating(false)}
          onSubmit={createModule}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 text-sm border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
        >
          + Add module
        </button>
      )}
    </div>
  )
}

function SortableModuleRow(props: {
  tenantId: string
  module: ModuleSummary
  editing: boolean
  busy: boolean
  onEditStart: () => void
  onEditCancel: () => void
  onSave: (singular: string, plural: string) => void
  onToggleActive: (next: boolean) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.module.id,
    disabled: props.editing || props.busy,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? 'var(--surface-muted, #f3f4f6)' : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <ModuleRow
        {...props}
        dragHandle={
          <button
            type="button"
            aria-label="Drag to reorder"
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1 disabled:opacity-30"
            disabled={props.editing || props.busy}
            {...attributes}
            {...listeners}
          >
            <svg width="12" height="16" viewBox="0 0 12 16" fill="none" aria-hidden>
              <circle cx="3" cy="3"  r="1.4" fill="currentColor" />
              <circle cx="9" cy="3"  r="1.4" fill="currentColor" />
              <circle cx="3" cy="8"  r="1.4" fill="currentColor" />
              <circle cx="9" cy="8"  r="1.4" fill="currentColor" />
              <circle cx="3" cy="13" r="1.4" fill="currentColor" />
              <circle cx="9" cy="13" r="1.4" fill="currentColor" />
            </svg>
          </button>
        }
      />
    </div>
  )
}

function ModuleRow({
  tenantId,
  module: m,
  editing,
  busy,
  dragHandle,
  onEditStart,
  onEditCancel,
  onSave,
  onToggleActive,
  onDelete,
}: {
  tenantId: string
  module: ModuleSummary
  editing: boolean
  busy: boolean
  dragHandle?: React.ReactNode
  onEditStart: () => void
  onEditCancel: () => void
  onSave: (singular: string, plural: string) => void
  onToggleActive: (next: boolean) => void
  onDelete: () => void
}) {
  const [singular, setSingular] = useState(m.singular)
  const [plural, setPlural] = useState(m.plural)

  if (editing) {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="text-gray-600 dark:text-gray-300">Singular</span>
            <input
              value={singular}
              onChange={(e) => setSingular(e.target.value)}
              className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
            />
          </label>
          <label className="text-xs">
            <span className="text-gray-600 dark:text-gray-300">Plural</span>
            <input
              value={plural}
              onChange={(e) => setPlural(e.target.value)}
              className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
            />
          </label>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          Slug: <code className="font-mono">{m.slug}</code> (immutable)
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => onSave(singular.trim(), plural.trim())}
            disabled={busy}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {busy && <LoadingSpinner size="sm" className="text-white" />}
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onEditCancel}
            disabled={busy}
            className="text-sm border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${!m.active ? 'opacity-60' : ''}`}>
      {dragHandle}
      <label
        className="inline-flex items-center gap-2"
        title={m.isDefault ? 'The default module cannot be hidden.' : 'Toggle visibility in the sidebar'}
      >
        {busy ? (
          <LoadingSpinner size="sm" />
        ) : (
          <input
            type="checkbox"
            checked={m.active}
            disabled={m.isDefault}
            onChange={(e) => onToggleActive(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 h-4 w-4 disabled:opacity-50"
          />
        )}
      </label>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {m.plural}
          {m.isDefault && (
            <span className="ml-2 text-[10px] uppercase tracking-wider bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/30 rounded px-1.5 py-0.5">
              Default
            </span>
          )}
          {!m.active && (
            <span className="ml-2 text-[10px] uppercase tracking-wider bg-gray-100 dark:bg-[var(--surface-muted)] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[var(--border)] rounded px-1.5 py-0.5">
              Hidden
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span>Singular: {m.singular}</span>
          <span className="mx-2">·</span>
          <span>
            Slug: <code className="font-mono">{m.slug}</code>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/superadmin/tenants/${tenantId}/modules/${m.slug}/fields`}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Fields
        </Link>
        <Link
          href={`/superadmin/tenants/${tenantId}/modules/${m.slug}/statuses`}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Statuses
        </Link>
        <button
          type="button"
          onClick={onEditStart}
          className="text-xs border border-gray-200 dark:border-[var(--border)] rounded-md px-2.5 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
        >
          Rename
        </button>
        {!m.isDefault && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs border border-red-200 dark:border-red-500/40 rounded-md px-2.5 py-1 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

function CreateForm({
  creating,
  onCancel,
  onSubmit,
}: {
  creating: boolean
  onCancel: () => void
  onSubmit: (singular: string, plural: string, slug: string) => void
}) {
  const [singular, setSingular] = useState('')
  const [plural, setPlural] = useState('')
  const [slug, setSlug] = useState('')

  return (
    <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-4 space-y-3">
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">New module</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs">
          <span className="text-gray-600 dark:text-gray-300">Singular *</span>
          <input
            value={singular}
            onChange={(e) => {
              setSingular(e.target.value)
              if (!slug) setSlug(slugify(e.target.value))
            }}
            placeholder="Walk-in"
            className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
          />
        </label>
        <label className="text-xs">
          <span className="text-gray-600 dark:text-gray-300">Plural *</span>
          <input
            value={plural}
            onChange={(e) => setPlural(e.target.value)}
            placeholder="Walk-ins"
            className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)]"
          />
        </label>
        <label className="text-xs">
          <span className="text-gray-600 dark:text-gray-300">URL slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="walk-in"
            className="mt-1 w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[var(--surface)] font-mono"
          />
        </label>
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => onSubmit(singular.trim(), plural.trim(), slug.trim())}
          disabled={creating || !singular.trim() || !plural.trim()}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {creating && <LoadingSpinner size="sm" className="text-white" />}
          {creating ? 'Creating…' : 'Create module'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="text-sm border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
