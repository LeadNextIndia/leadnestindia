'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeftIcon } from '@/components/icons'

type Field = {
  key: string
  label: string
  type: string
  required: boolean
  options: string[] | null
}

export default function NewLeadPage() {
  const supabase = createClient()
  const router = useRouter()

  const [fields, setFields] = useState<Field[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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

          const { data: tu, error } = await supabase
  .from("tenant_users")
  .select("tenant_id")
  .eq("user_id", user.id)
  .maybeSingle();

if (error) {
  console.error(error);
  setError(error.message);
  return;
}

if (!tu) {
  setError("No store is linked to your account yet.");
  return;
}
      setTenantId(tu.tenant_id)

      const { data: defs } = await supabase
        .from('field_definitions')
        .select('key,label,type,required,options')
        .eq('tenant_id', tu.tenant_id)
        .eq('active', true)
        .order('sort_order')

      setFields(defs ?? [])
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
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Back to leads
      </Link>

      <div className="mt-3">
        <h1 className="text-xl font-semibold text-gray-900">New Lead</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details. The fields below are configured for your store.
        </p>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-5">
        {loading && <p className="text-sm text-gray-400">Loading form…</p>}

        {!loading && fields.length === 0 && !error && (
          <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
            <div className="text-sm font-medium text-gray-700">No fields yet</div>
            <p className="text-xs text-gray-500 mt-1">
              Ask your admin to add fields in{' '}
              <code className="text-[11px] bg-gray-100 rounded px-1 py-0.5">field_definitions</code>.
            </p>
          </div>
        )}

        {!loading && fields.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label htmlFor={f.key} className="block text-xs font-medium text-gray-700">
                  {f.label}
                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {f.type === 'select' ? (
                  <select
                    id={f.key}
                    required={f.required}
                    value={values[f.key] ?? ''}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            ))}

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
              >
                {saving ? 'Saving…' : 'Save Lead'}
              </button>
              <Link
                href="/dashboard"
                className="border border-gray-200 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}

        {!loading && fields.length === 0 && error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
