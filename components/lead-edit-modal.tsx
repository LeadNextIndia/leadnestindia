'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ModuleStatus } from '@/lib/lead-modules'

const FALLBACK_STATUSES: ModuleStatus[] = [
  { id: 'f-new',       key: 'new',       label: 'New',       color: 'blue',   sortOrder: 0, isDefault: true,  isTerminal: false },
  { id: 'f-contacted', key: 'contacted', label: 'Contacted', color: 'amber',  sortOrder: 1, isDefault: false, isTerminal: false },
  { id: 'f-qualified', key: 'qualified', label: 'Qualified', color: 'indigo', sortOrder: 2, isDefault: false, isTerminal: false },
  { id: 'f-won',       key: 'won',       label: 'Won',       color: 'green',  sortOrder: 3, isDefault: false, isTerminal: true  },
  { id: 'f-lost',      key: 'lost',      label: 'Lost',      color: 'red',    sortOrder: 4, isDefault: false, isTerminal: true  },
]

export type EditableLead = {
  id: string
  status: string | null
  custom_data: Record<string, unknown> | null
  assigned_to: string | null
  follow_up_at: string | null
}

export type Member = {
  user_id: string
  email: string | null
}

export type FieldDef = {
  key: string
  label: string
  type: string
  required: boolean
  options: string[] | null
}

type Activity = {
  id: string
  kind: 'note' | 'status_change' | 'assigned' | 'follow_up_set' | 'edited' | 'created'
  body: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_id: string | null
  user_email: string | null
}

type Props = {
  lead: EditableLead
  fieldDefs: FieldDef[]
  members: Member[]
  statuses?: ModuleStatus[]
  onClose: () => void
  invoicingEnabled?: boolean
  activityEnabled?: boolean
}

function memberLabel(m: Member): string {
  return m.email ?? m.user_id.slice(0, 8)
}

function toDateInputValue(ts: string | null): string {
  if (!ts) return ''
  return ts.slice(0, 10) // yyyy-mm-dd
}

function fromDateInputValue(s: string): string | null {
  return s ? new Date(s + 'T09:00:00').toISOString() : null
}

export function LeadEditModal({ lead, fieldDefs, members, statuses, onClose, invoicingEnabled, activityEnabled }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'details' | 'activity'>('details')
  const availableStatuses = statuses && statuses.length > 0 ? statuses : FALLBACK_STATUSES

  // If activity is disabled and somehow the tab got set to 'activity', pull it back.
  const currentTab: 'details' | 'activity' = activityEnabled ? tab : 'details'
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  // Details tab state
  const [status, setStatus] = useState(lead.status ?? 'new')
  const [assignedTo, setAssignedTo] = useState<string>(lead.assigned_to ?? '')
  const [followUp, setFollowUp] = useState<string>(toDateInputValue(lead.follow_up_at))
  const [data, setData] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    fieldDefs.forEach((f) => {
      d[f.key] = String((lead.custom_data as Record<string, unknown> | null)?.[f.key] ?? '')
    })
    return d
  })

  // Activity tab state
  const [activity, setActivity] = useState<Activity[] | null>(null)
  const [activityErr, setActivityErr] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)

  useEffect(() => {
    if (!activityEnabled) return
    if (currentTab !== 'activity' || activity !== null) return
    let alive = true
    fetch(`/api/leads/${lead.id}/activity`)
      .then((r) => r.json())
      .then((res) => {
        if (!alive) return
        if (res.error) setActivityErr(res.error)
        else setActivity(res.activity as Activity[])
      })
      .catch((e) => alive && setActivityErr(String(e)))
    return () => { alive = false }
  }, [currentTab, activity, lead.id, activityEnabled])

  function save() {
    startTransition(async () => {
      setSaveError(null)
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          custom_data: data,
          assigned_to: assignedTo || null,
          follow_up_at: fromDateInputValue(followUp),
        }),
      })
      const res_body = await res.json().catch(() => ({}))
      if (!res.ok) { setSaveError(res_body.error ?? 'Save failed.'); return }
      onClose()
      router.refresh()
    })
  }

  async function submitNote() {
    if (!note.trim()) return
    setNoteBusy(true)
    const res = await fetch(`/api/leads/${lead.id}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: note.trim() }),
    })
    const created = await res.json().catch(() => ({}))
    setNoteBusy(false)
    if (!res.ok) { setActivityErr(created.error ?? 'Could not save note.'); return }
    setActivity((prev) => [created as Activity, ...(prev ?? [])])
    setNote('')
  }

  const emailByUser = new Map(members.map((m) => [m.user_id, m.email ?? m.user_id.slice(0, 8)]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-[var(--surface)] rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[var(--border)]">
          <div className="flex gap-4">
            <TabButton active={currentTab === 'details'} onClick={() => setTab('details')}>Details</TabButton>
            {activityEnabled && (
              <TabButton active={currentTab === 'activity'} onClick={() => setTab('activity')}>Activity</TabButton>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {currentTab === 'details' && (
            <>
              {/* Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                  >
                    {availableStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>

                <Field label="Assign to">
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{memberLabel(m)}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Follow-up on">
                  <input
                    type="date"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              {/* Custom fields */}
              {fieldDefs.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-[var(--border)]">
                  {fieldDefs.map((f) => (
                    <Field key={f.key} label={f.label} required={f.required}>
                      {f.type === 'select' ? (
                        <select
                          value={data[f.key] ?? ''}
                          onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">Select…</option>
                          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={data[f.key] ?? ''}
                          onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                        />
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
                          value={data[f.key] ?? ''}
                          onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                        />
                      )}
                    </Field>
                  ))}
                </div>
              )}

              {saveError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{saveError}</p>
              )}
            </>
          )}

          {currentTab === 'activity' && activityEnabled && (
            <div className="space-y-4">
              <div>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note (visible to your teammates)"
                  className="w-full border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-2 text-sm"
                />
                <div className="flex justify-end mt-1">
                  <button
                    onClick={submitNote}
                    disabled={!note.trim() || noteBusy}
                    className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md px-3 py-1"
                  >
                    {noteBusy ? 'Adding…' : 'Add note'}
                  </button>
                </div>
              </div>

              {activityErr && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{activityErr}</p>
              )}

              {activity === null ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : activity.length === 0 ? (
                <p className="text-xs text-gray-500">No activity yet.</p>
              ) : (
                <ul className="space-y-2">
                  {activity.map((a) => (
                    <ActivityItem key={a.id} a={a} emailByUser={emailByUser} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {currentTab === 'details' && (
          <div className="flex gap-2 items-center px-5 py-4 border-t border-gray-200 dark:border-[var(--border)] bg-gray-50 dark:bg-[var(--surface-muted)]">
            <button
              onClick={save}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={onClose}
              className="border border-gray-200 dark:border-[var(--border)] text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md px-4 py-2 hover:bg-white dark:hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
            {invoicingEnabled && (
              <a
                href={`/dashboard/invoices/new?lead=${lead.id}`}
                className="ml-auto text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Generate invoice →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm font-medium pb-1 border-b-2 -mb-1 transition ${
        active
          ? 'border-blue-600 text-gray-900 dark:text-gray-100'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function ActivityItem({
  a,
  emailByUser,
}: {
  a: Activity
  emailByUser: Map<string, string | null>
}) {
  const who = a.user_email ?? (a.user_id ? emailByUser.get(a.user_id) ?? 'someone' : 'system')
  const when = new Date(a.created_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <li className="border border-gray-100 dark:border-[var(--border)] rounded-md px-3 py-2 bg-gray-50/50 dark:bg-[var(--surface-muted)]">
      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span><strong className="text-gray-700 dark:text-gray-200">{who}</strong> · {activityLabel(a, emailByUser)}</span>
        <span>{when}</span>
      </div>
      {a.body && (
        <p className="text-sm text-gray-800 dark:text-gray-100 mt-1 whitespace-pre-wrap">{a.body}</p>
      )}
    </li>
  )
}

function activityLabel(a: Activity, emailByUser: Map<string, string | null>): string {
  const m = a.metadata ?? {}
  switch (a.kind) {
    case 'note':          return 'added a note'
    case 'status_change': return `changed status ${m.from ?? '—'} → ${m.to ?? '—'}`
    case 'assigned': {
      const to = m.to ? emailByUser.get(String(m.to)) ?? String(m.to).slice(0, 8) : 'nobody'
      return `assigned to ${to}`
    }
    case 'follow_up_set': {
      const to = m.to ? String(m.to).slice(0, 10) : 'cleared'
      return `set follow-up to ${to}`
    }
    case 'edited':        return 'edited fields'
    case 'created':       return 'created the lead'
    default:              return a.kind
  }
}
