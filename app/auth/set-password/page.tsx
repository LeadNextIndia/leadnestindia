'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SparkleIcon } from '@/components/icons'

export default function SetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setEmail(user.email ?? null)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6 space-y-5"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center">
            <SparkleIcon className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Welcome to LeadNest</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Set your password</div>
          </div>
        </div>

        {email && (
          <p className="text-xs text-gray-500">
            You&apos;re setting a password for <span className="font-medium text-gray-800">{email}</span>.
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="At least 6 characters"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Repeat password"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-3 py-2 transition"
        >
          {loading ? 'Saving…' : 'Set password & continue'}
        </button>
      </form>
    </div>
  )
}
