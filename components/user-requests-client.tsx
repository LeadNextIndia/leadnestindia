'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type UserRequest = {
  id: string
  tenantName: string
  requesterEmail: string | null
  name: string
  email: string
  mobile: string | null
  requested_role: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected'
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

const statusColors: Record<UserRequest['status'], string> = {
  pending: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  approved: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

export function UserRequestsClient({ requests }: { requests: UserRequest[] }) {
  const [filter, setFilter] = useState<'all' | UserRequest['status']>('pending')
  const visible = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((v) => (
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
            {v}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-[var(--border)] p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No requests in this view.
        </div>
      )}

      {visible.map((r) => (
        <RequestCard key={r.id} r={r} />
      ))}
    </div>
  )
}

function RequestCard({ r }: { r: UserRequest }) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function decide(action: 'approve' | 'reject') {
    if (
      action === 'reject' &&
      !confirm(`Reject the request for ${r.email}? This can't be undone.`)
    ) {
      return
    }
    setBusy(action)
    setMsg(null)
    const res = await fetch(`/api/user-requests/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, notes: notes.trim() || null }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setMsg({ kind: 'err', text: json.error ?? `${action} failed` })
      return
    }
    setMsg({
      kind: 'ok',
      text: action === 'approve'
        ? json.mode === 'invited'
          ? `Invite sent to ${r.email}.`
          : `${r.email} already had an account — added to the tenant.`
        : `Rejected.`,
    })
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${statusColors[r.status]}`}>
              {r.status}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {r.requested_role}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {r.tenantName}
            </span>
          </div>
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
            {r.name} <span className="text-gray-400 dark:text-gray-500">·</span> {r.email}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-3">
            {r.mobile && <span>📱 {r.mobile}</span>}
            {r.requesterEmail && <span>Requested by {r.requesterEmail}</span>}
            <span>
              {new Date(r.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          {r.review_notes && (
            <div className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[var(--surface-muted)] border border-gray-200 dark:border-[var(--border)] rounded px-2 py-1.5">
              <strong>Notes:</strong> {r.review_notes}
            </div>
          )}
        </div>
      </div>

      {r.status === 'pending' && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[var(--border)] space-y-3">
          <textarea
            rows={2}
            maxLength={5000}
            placeholder="Optional notes (visible to the requester)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-xs bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide('approve')}
              disabled={!!busy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-medium rounded-md px-3 py-1.5 transition"
            >
              {busy === 'approve' ? 'Approving…' : 'Approve & provision'}
            </button>
            <button
              type="button"
              onClick={() => decide('reject')}
              disabled={!!busy}
              className="border border-gray-300 dark:border-[var(--border)] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] text-xs font-medium rounded-md px-3 py-1.5 transition disabled:opacity-60"
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
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
      )}
    </div>
  )
}
