'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MailIcon, TrashIcon, PlusIcon } from '@/components/icons'

type Member = {
  userId: string
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

export type PendingRequest = {
  id: string
  name: string
  email: string
  mobile: string | null
  requestedRole: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected'
  reviewNotes: string | null
  createdAt: string
  reviewedAt: string | null
}

export function TeamPageClient({
  members,
  currentUserId,
  requests,
}: {
  members: Member[]
  currentUserId: string
  requests: PendingRequest[]
}) {
  const router = useRouter()
  const [showRequest, setShowRequest] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [busy, startTransition] = useTransition()
  const [reqBusy, setReqBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const adminCount = members.filter((m) => m.role === 'admin').length
  const pending = requests.filter((r) => r.status === 'pending')
  const past = requests.filter((r) => r.status !== 'pending').slice(0, 10)

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setReqBusy(true)
    const res = await fetch('/api/user-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim() || null,
        requested_role: role,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setReqBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error ?? 'Request failed' })
      return
    }
    setMsg({
      kind: 'ok',
      text: `Request submitted for ${email}. Our team will review and get back to you.`,
    })
    setName('')
    setEmail('')
    setMobile('')
    setRole('user')
    setShowRequest(false)
    router.refresh()
  }

  function changeRole(userId: string, newRole: 'admin' | 'user') {
    startTransition(async () => {
      setMsg(null)
      const res = await fetch('/api/team/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Could not update role' })
        return
      }
      router.refresh()
    })
  }

  function removeMember(userId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from your team? They will lose access immediately.`)) return
    startTransition(async () => {
      setMsg(null)
      const res = await fetch('/api/team/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Could not remove' })
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Team</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {members.length} {members.length === 1 ? 'member' : 'members'} · {adminCount} admin
            {adminCount === 1 ? '' : 's'}
            {pending.length > 0 && (
              <> · <span className="text-amber-700 dark:text-amber-400">{pending.length} pending</span></>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            setShowRequest((v) => !v)
            setMsg(null)
          }}
          className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 transition"
        >
          <PlusIcon className="w-4 h-4" />
          Request user
        </button>
      </div>

      {msg && (
        <p
          className={
            msg.kind === 'ok'
              ? 'text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2'
              : 'text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2'
          }
        >
          {msg.text}
        </p>
      )}

      {showRequest && (
        <form
          onSubmit={submitRequest}
          className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <MailIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Request a new user
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Superadmin will review this request and provision the user. You&apos;ll get an email once approved.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Full name
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Amit Sharma"
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Mobile (optional)
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={reqBusy}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
            >
              {reqBusy ? 'Submitting…' : 'Submit request'}
            </button>
            <button
              type="button"
              onClick={() => setShowRequest(false)}
              className="border border-gray-200 dark:border-[var(--border)] rounded-md px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Pending requests
          </h2>
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 dark:bg-amber-500/10 text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-left px-4 py-2 font-medium">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 dark:divide-amber-500/20">
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200 text-xs">{r.email}</td>
                    <td className="px-4 py-2.5 text-xs capitalize">{r.requestedRole}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Members</h2>
        <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Added</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
              {members.map((m) => {
                const isSelf = m.userId === currentUserId
                const lastAdmin = m.role === 'admin' && adminCount === 1
                return (
                  <tr key={m.userId} className="hover:bg-gray-50/60 dark:hover:bg-[var(--surface-muted)]">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                      {m.email}
                      {isSelf && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-[var(--border)] rounded px-1 py-0.5">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={m.role}
                        disabled={busy || (isSelf && lastAdmin)}
                        onChange={(e) => changeRole(m.userId, e.target.value as 'admin' | 'user')}
                        className="text-xs border border-gray-200 dark:border-[var(--border)] rounded px-2 py-1 bg-white dark:bg-[var(--surface)] disabled:opacity-60"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(m.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => removeMember(m.userId, m.email)}
                        disabled={busy || isSelf || lastAdmin}
                        title={
                          isSelf ? "You can't remove yourself"
                          : lastAdmin ? "Can't remove the last admin"
                          : 'Remove member'
                        }
                        className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:text-gray-300 dark:disabled:text-gray-600"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}

              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No members yet. Request your first teammate above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Recent request history
          </h2>
          <div className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
                {past.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200 text-xs">{r.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          'text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ' +
                          (r.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300')
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {r.reviewedAt
                        ? new Date(r.reviewedAt).toLocaleDateString('en-GB')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
