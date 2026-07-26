'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusIcon, BuildingIcon } from '@/components/icons'

type TenantRow = {
  id: string
  name: string
  createdAt: string
  memberCount: number
  adminCount: number
}

export function SuperadminPageClient({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function onboard(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    const res = await fetch('/api/superadmin/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: companyName.trim(),
        adminEmail: adminEmail.trim(),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error ?? 'Onboarding failed' })
      return
    }
    setMsg({
      kind: 'ok',
      text: `Created "${companyName}". Invite sent to ${adminEmail}.`,
    })
    setCompanyName('')
    setAdminEmail('')
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tenants.length} {tenants.length === 1 ? 'company' : 'companies'} on the platform
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setMsg(null) }}
          className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 transition"
        >
          <PlusIcon className="w-4 h-4" />
          Onboard company
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

      {showForm && (
        <form
          onSubmit={onboard}
          className="rounded-lg border border-gray-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <BuildingIcon className="w-4 h-4 text-indigo-600" />
            Onboard a new customer company
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Retail Pvt Ltd"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">First admin email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="owner@acme.com"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            We&apos;ll create the company and email the admin a link to set their password.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
            >
              {busy ? 'Creating…' : 'Create company & invite admin'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
              <th className="text-left px-4 py-2 font-medium">Company</th>
              <th className="text-left px-4 py-2 font-medium">Members</th>
              <th className="text-left px-4 py-2 font-medium">Admins</th>
              <th className="text-left px-4 py-2 font-medium">Onboarded</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-2.5 text-gray-900 font-medium">{t.name}</td>
                <td className="px-4 py-2.5 text-gray-700">{t.memberCount}</td>
                <td className="px-4 py-2.5 text-gray-700">{t.adminCount}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {new Date(t.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/superadmin/tenants/${t.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Configure →
                  </Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                  No companies yet. Onboard your first customer above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
