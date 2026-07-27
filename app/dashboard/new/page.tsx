import Link from 'next/link'
import { ArrowLeftIcon } from '@/components/icons'
import { LeadForm } from '@/components/lead-form'

export default function NewLeadPage() {
  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Back to leads
      </Link>

      <div className="mt-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">New Lead</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Fill in the details. The fields below are configured for your store.
        </p>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5">
        <LeadForm />
      </div>
    </div>
  )
}
