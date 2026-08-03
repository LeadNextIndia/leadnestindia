'use client'

import { useEffect, useState } from 'react'
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
  const [filter, setFilter] = useState<'all' | Ticket['status']>('all')
  const [open, setOpen] = useState<Ticket | null>(null)

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

      <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Subject</th>
              <th className="text-left px-4 py-2 font-medium">Tenant</th>
              <th className="text-left px-4 py-2 font-medium">Priority</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Raised</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
            {visible.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-gray-50/70 dark:hover:bg-[var(--surface-muted)] cursor-pointer"
                onClick={() => setOpen(t)}
              >
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs">
                  {t.subject}
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200 text-xs">{t.tenantName}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${priorityColors[t.priority]}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${statusColors[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(t)
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <TicketModal ticket={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function TicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const router = useRouter()
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [resolution, setResolution] = useState(ticket.resolution ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

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
    setTimeout(onClose, 800)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[var(--surface)] rounded-xl shadow-2xl border border-gray-200 dark:border-[var(--border)] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-[var(--border)]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${priorityColors[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${statusColors[ticket.status]}`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-4">
              {ticket.subject}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 -mt-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Tenant</div>
              <div className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{ticket.tenantName}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Raised by</div>
              <div className="mt-0.5 font-medium text-gray-900 dark:text-gray-100 truncate">
                {ticket.creatorEmail ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Raised on</div>
              <div className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                {new Date(ticket.created_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
              Description
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap rounded-md border border-gray-200 dark:border-[var(--border)] bg-gray-50 dark:bg-[var(--surface-muted)] p-3">
              {ticket.body}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Ticket['status'])}
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Resolution notes (visible to the customer)
              </label>
              <textarea
                rows={4}
                maxLength={5000}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="What did you do to resolve this?"
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
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
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-[var(--border)] flex justify-end gap-2 bg-gray-50/50 dark:bg-[var(--surface-muted)]">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-[var(--border)] text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[var(--surface)]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 font-medium"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
