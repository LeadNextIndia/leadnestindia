'use client'

import { useEffect, useState } from 'react'
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
  const [open, setOpen] = useState<UserRequest | null>(null)
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

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-[var(--border)] p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No requests in this view.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Tenant</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Requested</th>
                <th className="text-right px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-[var(--surface-muted)] cursor-pointer"
                  onClick={() => setOpen(r)}
                >
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200 text-xs">{r.email}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200 text-xs">{r.tenantName}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 capitalize">
                    {r.requested_role}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${statusColors[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpen(r)
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
      )}

      {open && <RequestModal request={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function RequestModal({ request, onClose }: { request: UserRequest; onClose: () => void }) {
  const router = useRouter()
  const [notes, setNotes] = useState(request.review_notes ?? '')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
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

  async function decide(action: 'approve' | 'reject') {
    if (
      action === 'reject' &&
      !confirm(`Reject the request for ${request.email}? This can't be undone.`)
    ) {
      return
    }
    setBusy(action)
    setMsg(null)
    const res = await fetch(`/api/user-requests/${request.id}`, {
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
      text:
        action === 'approve'
          ? json.mode === 'invited'
            ? `Invite sent to ${request.email}.`
            : `${request.email} already had an account — added to the tenant.`
          : `Rejected.`,
    })
    router.refresh()
    setTimeout(onClose, 900)
  }

  const isPending = request.status === 'pending'

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
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${statusColors[request.status]}`}>
                {request.status}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Requested role: {request.requested_role}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-4">
              User creation request for {request.name}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <FieldRow label="Full name" value={request.name} />
            <FieldRow label="Email" value={request.email} />
            <FieldRow label="Mobile" value={request.mobile ?? '—'} />
            <FieldRow label="Requested role" value={request.requested_role} />
            <FieldRow label="Tenant" value={request.tenantName} />
            <FieldRow label="Requested by" value={request.requesterEmail ?? '—'} />
            <FieldRow
              label="Requested on"
              value={new Date(request.created_at).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            />
            {request.reviewed_at && (
              <FieldRow
                label="Reviewed on"
                value={new Date(request.reviewed_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              />
            )}
          </div>

          {request.review_notes && !isPending && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
                Review notes
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap rounded-md border border-gray-200 dark:border-[var(--border)] bg-gray-50 dark:bg-[var(--surface-muted)] p-3">
                {request.review_notes}
              </div>
            </div>
          )}

          {isPending && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Notes (optional, shared with the requester)
              </label>
              <textarea
                rows={3}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

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
          {isPending && (
            <>
              <button
                type="button"
                onClick={() => decide('reject')}
                disabled={!!busy}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-[var(--border)] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface)] disabled:opacity-60"
              >
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                type="button"
                onClick={() => decide('approve')}
                disabled={!!busy}
                className="text-sm px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 font-medium"
              >
                {busy === 'approve' ? 'Approving…' : 'Approve & provision'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 text-gray-900 dark:text-gray-100 capitalize break-words">{value}</div>
    </div>
  )
}
