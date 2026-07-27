'use client'

import { useState } from 'react'

type Msg = { kind: 'ok' | 'err'; text: string } | null

export function SupportTicketForm() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/support-tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, body, priority }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: json.error ?? 'Failed to submit' })
      return
    }
    setSubject('')
    setBody('')
    setPriority('normal')
    setMsg({ kind: 'ok', text: 'Ticket submitted — our team will reach out shortly.' })
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
          Subject
        </label>
        <input
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Short summary of the issue"
          className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
          Description
        </label>
        <textarea
          required
          rows={5}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's happening? What have you tried? Any error messages?"
          className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {body.length} / 5000
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
          Priority
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
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
        type="submit"
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
      >
        {busy ? 'Submitting…' : 'Submit ticket'}
      </button>
    </form>
  )
}
