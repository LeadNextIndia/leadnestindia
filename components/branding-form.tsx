'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Msg = { kind: 'ok' | 'err'; text: string } | null

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export function BrandingForm({
  initialDisplayName,
  initialBackgroundUrl,
}: {
  initialDisplayName: string | null
  initialBackgroundUrl: string | null
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<Msg>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<Msg>(null)
  const [preview, setPreview] = useState<string | null>(initialBackgroundUrl)

  async function saveName() {
    setSavingName(true)
    setNameMsg(null)
    const res = await fetch('/api/tenant/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: displayName.trim() || null }),
    })
    const json = await res.json().catch(() => ({}))
    setSavingName(false)
    if (!res.ok) {
      setNameMsg({ kind: 'err', text: json.error ?? 'Save failed' })
      return
    }
    setNameMsg({ kind: 'ok', text: 'Saved' })
    router.refresh()
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadMsg(null)

    if (!ALLOWED.includes(file.type)) {
      setUploadMsg({ kind: 'err', text: 'Only JPEG, PNG or WEBP allowed' })
      e.target.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadMsg({ kind: 'err', text: 'Max 5 MB' })
      e.target.value = ''
      return
    }

    setUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/tenant/branding', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    setUploading(false)
    e.target.value = ''

    if (!res.ok) {
      setUploadMsg({ kind: 'err', text: json.error ?? 'Upload failed' })
      setPreview(initialBackgroundUrl)
      return
    }
    setUploadMsg({ kind: 'ok', text: 'Uploaded — refresh to see it applied' })
    router.refresh()
  }

  async function removeBackground() {
    setUploading(true)
    setUploadMsg(null)
    const res = await fetch('/api/tenant/branding', { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) {
      setUploadMsg({ kind: 'err', text: json.error ?? 'Remove failed' })
      return
    }
    setPreview(null)
    setUploadMsg({ kind: 'ok', text: 'Removed' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Company display name</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Shown at the top of the dashboard. Falls back to your legal company name if left blank.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Sharma Motors"
            className="flex-1 max-w-sm border border-gray-200 dark:border-[var(--border)] rounded-md px-3 py-2 text-sm bg-white dark:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={savingName}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md px-4 py-2 transition"
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
        {nameMsg && (
          <p
            className={
              'mt-2 text-xs ' +
              (nameMsg.kind === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400')
            }
          >
            {nameMsg.text}
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dashboard background</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Upload an image (JPEG / PNG / WEBP, up to 5 MB) shown as a subtle background on the dashboard.
        </p>

        <div className="mt-3 flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-full sm:w-64 h-32 rounded-md border border-dashed border-gray-300 dark:border-[var(--border)] bg-gray-50 dark:bg-[var(--surface-muted)] overflow-hidden flex items-center justify-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Background preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">No background set</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 border border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] rounded-md px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 transition"
            >
              {uploading ? 'Uploading…' : 'Choose file'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFilePick}
              className="hidden"
            />
            {preview && (
              <button
                type="button"
                onClick={removeBackground}
                disabled={uploading}
                className="text-xs text-red-600 dark:text-red-400 hover:underline text-left"
              >
                Remove background
              </button>
            )}
          </div>
        </div>

        {uploadMsg && (
          <p
            className={
              'mt-3 text-xs ' +
              (uploadMsg.kind === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400')
            }
          >
            {uploadMsg.text}
          </p>
        )}
      </section>
    </div>
  )
}
