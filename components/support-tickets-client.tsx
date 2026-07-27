'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type Ticket = {
  id: string
  tenantName: string
  creatorEmail: string | null
  subject: string
  body: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  resolution: string | null
  created_at: string
  resolved_at: string | null
}

const priorityColors: Record<Ticket['priority'], string> = {
  low: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300',
  normal: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
  high: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  urgent: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
}

const statusColors: Record<Ticket['status'], string> = {
  open: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  resolved: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300',
}

export function SupportTicketsClient({ tickets }: { tickets: Ticket[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Ticket['status']>('all')

  const visible = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={
              'px-2.5 py-1 text-xs rounded-md border transition capitalize ' +
              (filter === v
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-[var(--surface)] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]')
            }
          >
            {v.replace('_', ' ')}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-[var(--border)] p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No tickets in this view.
        </div>
      )}

      {visible.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            className="w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${priorityColors[t.priority]}`}>
                    {t.priority}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${statusColors[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t.tenantName}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {t.subject}
                </div>
                {t.creatorEmail && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    from {t.creatorEmail}
                  </div>
                )}
              </div>
            </div>
          </button>

          {expanded === t.id && <TicketDetail ticket={t} />}
        </div>
      ))}
    </div>
  )
}

function TicketDetail({ ticket }: { ticket: Ticket }) {
  const router = useRouter()
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [resolution, setResolution] = useState(ticket.resolution ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/support-tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, resolution: resolution || null }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: json.error ?? 'Update failed' })
      return
    }
    setMsg({ kind: 'ok', text: 'Updated' })
    router.refresh()
  }

  return (
    <div className="border-t border-gray-200 dark:border-[var(--border)] px-5 py-4 bg-gray-50/30 dark:bg-[var(--surface-muted)] space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
          Description
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {ticket.body}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Ticket['status'])}
            className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
          Resolution notes (optional)
        </label>
        <textarea
          rows={3}
          maxLength={5000}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {msg && (
        <p
          className={
            'text-xs ' +
            (msg.kind === 'ok'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-700 dark:text-red-400')
          }
        >
          {msg.text}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
