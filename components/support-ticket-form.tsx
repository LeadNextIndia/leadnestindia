'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Msg = { kind: 'ok' | 'err'; text: string } | null

export function SupportTicketForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  function close() {
    setOpen(false)
    setSubject('')
    setBody('')
    setPriority('normal')
    setMsg(null)
  }

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
    setMsg({ kind: 'ok', text: 'Ticket submitted — see status below.' })
    router.refresh()
    // Auto-close after 1.5s so user sees the success
    setTimeout(() => setOpen(false), 1500)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md px-4 py-2 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New ticket
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 max-w-xl rounded-lg border border-gray-200 dark:border-[var(--border)] bg-gray-50/60 dark:bg-[var(--surface-muted)] p-5"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Raise a new ticket</div>
        <button
          type="button"
          onClick={close}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

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

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
        >
          {busy ? 'Submitting…' : 'Submit ticket'}
        </button>
        <button
          type="button"
          onClick={close}
          className="border border-gray-200 dark:border-[var(--border)] rounded-md px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[var(--surface)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
