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

export function TeamPageClient({
  members,
  currentUserId,
}: {
  members: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user')
  const [busy, startTransition] = useTransition()
  const [inviteBusy, setInviteBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const adminCount = members.filter((m) => m.role === 'admin').length

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setInviteBusy(true)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const data = await res.json().catch(() => ({}))
    setInviteBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error ?? 'Invite failed' })
      return
    }
    setMsg({
      kind: 'ok',
      text:
        data.mode === 'invited'
          ? `Invite sent to ${inviteEmail}.`
          : `${inviteEmail} was already registered — added to your team.`,
    })
    setInviteEmail('')
    setInviteRole('user')
    setShowInvite(false)
    router.refresh()
  }

  function changeRole(userId: string, role: 'admin' | 'user') {
    startTransition(async () => {
      setMsg(null)
      const res = await fetch('/api/team/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Could not update role' })
        return
      }
      router.refresh()
    })
  }

  function removeMember(userId: string, email: string) {
    if (!confirm(`Remove ${email} from your team? They will lose access immediately.`)) return
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
          <h1 className="text-xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.length} {members.length === 1 ? 'member' : 'members'} · {adminCount} admin
            {adminCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => { setShowInvite((v) => !v); setMsg(null) }}
          className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 transition"
        >
          <PlusIcon className="w-4 h-4" />
          Invite member
        </button>
      </div>

      {msg && (
        <p
          className={
            msg.kind === 'ok'
              ? 'text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2'
              : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'
          }
        >
          {msg.text}
        </p>
      )}

      {showInvite && (
        <form
          onSubmit={submitInvite}
          className="rounded-lg border border-gray-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <MailIcon className="w-4 h-4 text-blue-600" />
            Invite a team member
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'user')}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            They&apos;ll receive an email with a link to set a password and join your store.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={inviteBusy}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
            >
              {inviteBusy ? 'Sending…' : 'Send invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="border border-gray-200 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Added</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const isSelf = m.userId === currentUserId
              const lastAdmin = m.role === 'admin' && adminCount === 1
              return (
                <tr key={m.userId} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-gray-900">
                    {m.email}
                    {isSelf && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400 border border-gray-200 rounded px-1 py-0.5">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={m.role}
                      disabled={busy || (isSelf && lastAdmin)}
                      onChange={(e) => changeRole(m.userId, e.target.value as 'admin' | 'user')}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-60"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => removeMember(m.userId, m.email)}
                      disabled={busy || isSelf || lastAdmin}
                      title={
                        isSelf ? 'You can\'t remove yourself'
                        : lastAdmin ? 'Can\'t remove the last admin'
                        : 'Remove member'
                      }
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:text-gray-300 disabled:hover:text-gray-300"
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
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                  No members yet. Invite your first teammate above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
