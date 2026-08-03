'use client'

import { useEffect, useState } from 'react'
import { LeadForm } from '@/components/lead-form'
import { PlusIcon } from '@/components/icons'

type Props = {
  moduleSlug?: string
  moduleSingular?: string
}

export function NewLeadButton({ moduleSlug, moduleSingular }: Props = {}) {
  const [open, setOpen] = useState(false)
  const label = moduleSingular ?? 'Lead'

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 transition"
      >
        <PlusIcon className="w-4 h-4" /> New {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-lead-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-lg bg-white dark:bg-[var(--surface)] rounded-xl shadow-2xl border border-gray-200 dark:border-[var(--border)] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-[var(--border)]">
              <div>
                <h2 id="new-lead-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  New {label}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  The fields below are configured for your store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 -mt-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <LeadForm
                moduleSlug={moduleSlug}
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
                submitLabel={`Save ${label}`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
