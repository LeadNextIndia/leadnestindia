import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from '@/components/icons'
import { LeadForm } from '@/components/lead-form'
import { requireSession } from '@/lib/authz'
import { serverGetModuleConfig } from '@/lib/lead-modules-server'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function NewModuleLeadPage({ params }: Props) {
  const session = await requireSession()
  if (!session.tenantId) notFound()
  const { slug } = await params
  const config = await serverGetModuleConfig(session.tenantId, slug)
  if (!config) notFound()

  return (
    <div className="max-w-xl">
      <Link
        href={`/dashboard/m/${config.slug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Back to {config.plural.toLowerCase()}
      </Link>

      <div className="mt-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          New {config.singular}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Fill in the details. The fields below are configured for this module.
        </p>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5">
        <LeadForm moduleSlug={config.slug} submitLabel={`Save ${config.singular}`} />
      </div>
    </div>
  )
}
