'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type LeadFormField = {
  key: string
  label: string
  type: string
  required: boolean
  options: string[] | null
}

export function LeadForm({
  initialFields,
  onSuccess,
  onCancel,
  submitLabel = 'Save Lead',
}: {
  initialFields?: LeadFormField[]
  onSuccess?: () => void
  onCancel?: () => void
  submitLabel?: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const [fields, setFields] = useState<LeadFormField[]>(initialFields ?? [])
  const [values, setValues] = useState<Record<string, string>>({})
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(initialFields === undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in.')
        setLoading(false)
        return
      }

      const { data: tu, error: tuErr } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (tuErr) {
        setError(tuErr.message)
        setLoading(false)
        return
      }
      if (!tu) {
        setError('No store is linked to your account yet.')
        setLoading(false)
        return
      }
      setTenantId(tu.tenant_id)

      if (initialFields === undefined) {
        const { data: defs } = await supabase
          .from('field_definitions')
          .select('key,label,type,required,options')
          .eq('tenant_id', tu.tenant_id)
          .eq('active', true)
          .order('sort_order')

        setFields(defs ?? [])
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) {
      setError('No store linked to your account yet.')
      return
    }
    setError(null)
    setSaving(true)

    const { error: insertError } = await supabase.from('leads').insert({
      tenant_id: tenantId,
      custom_data: values,
      source: 'web',
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setValues({})
    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading form…</p>
  }

  if (fields.length === 0 && !error) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 dark:border-[var(--border)] p-6 text-center">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">No fields yet</div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Ask your admin to add fields in{' '}
          <code className="text-[11px] bg-gray-100 dark:bg-[var(--surface-muted)] rounded px-1 py-0.5">field_definitions</code>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <label htmlFor={f.key} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            {f.label}
            {f.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>

          {f.type === 'select' ? (
            <select
              id={f.key}
              required={f.required}
              value={values[f.key] ?? ''}
              onChange={(e) => updateField(f.key, e.target.value)}
              className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select…</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              id={f.key}
              required={f.required}
              rows={3}
              value={values[f.key] ?? ''}
              onChange={(e) => updateField(f.key, e.target.value)}
              className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          ) : (
            <input
              id={f.key}
              type={
                f.type === 'number' ? 'number' :
                f.type === 'date'   ? 'date' :
                f.type === 'email'  ? 'email' :
                f.type === 'tel'    ? 'tel' :
                'text'
              }
              required={f.required}
              value={values[f.key] ?? ''}
              onChange={(e) => updateField(f.key, e.target.value)}
              className="w-full border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          )}
        </div>
      ))}

      {error && (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-[var(--border)]">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-200 dark:border-[var(--border)] rounded-md px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
