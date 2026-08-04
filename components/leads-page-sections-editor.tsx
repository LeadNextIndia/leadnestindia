'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { LoadingSpinner } from '@/components/loading-spinner'
import {
  SECTION_META,
  type LeadsPageSection,
} from '@/lib/layout-config'

type Props = {
  tenantId: string
  initialSections: LeadsPageSection[]
}

export function LeadsPageSectionsEditor({ tenantId, initialSections }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<LeadsPageSection[]>(initialSections)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.type === active.id)
    const newIndex = sections.findIndex((s) => s.type === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setSections((prev) => arrayMove(prev, oldIndex, newIndex))
    setSaved(false)
  }

  function toggleVisible(type: string, visible: boolean) {
    setSections((prev) => prev.map((s) => (s.type === type ? { ...s, visible } : s)))
    setSaved(false)
  }

  async function save() {
    setError(null)
    setSaving(true)
    const res = await fetch(`/api/superadmin/tenant/${tenantId}/layout`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sections }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Save failed')
      return
    }
    setSaved(true)
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
        Drag to reorder the sections that appear on this tenant&apos;s records page.
        Untick to hide a section. Changes apply immediately after save.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] divide-y divide-gray-100 dark:divide-[var(--border)]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.type)} strategy={verticalListSortingStrategy}>
            {sections.map((s) => (
              <SortableSectionRow key={s.type} section={s} onToggleVisible={toggleVisible} />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-1.5 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" className="text-white" />}
          {saving ? 'Saving…' : 'Save layout'}
        </button>
        {saved && <span className="text-sm text-green-700 dark:text-green-400">Saved.</span>}
      </div>
    </div>
  )
}

function SortableSectionRow({
  section,
  onToggleVisible,
}: {
  section: LeadsPageSection
  onToggleVisible: (type: string, visible: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.type,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? 'var(--surface-muted, #f3f4f6)' : undefined,
  }
  const meta = SECTION_META[section.type]
  return (
    <div ref={setNodeRef} style={style} className={`px-4 py-3 flex items-center gap-3 ${!section.visible ? 'opacity-60' : ''}`}>
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1"
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
      <input
        type="checkbox"
        checked={section.visible}
        onChange={(e) => onToggleVisible(section.type, e.target.checked)}
        className="rounded border-gray-300 text-indigo-600 h-4 w-4"
        aria-label={`Show ${meta.label}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{meta.label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{meta.desc}</div>
      </div>
      <code className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{section.type}</code>
    </div>
  )
}
