import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/authz'
import { getTenantBranding } from '@/lib/branding'
import { BrandingForm } from '@/components/branding-form'
import { SupportTicketForm } from '@/components/support-ticket-form'

export default async function SettingsPage() {
  const session = await requireAdmin()
  if (!session.tenantId) redirect('/dashboard')

  const branding = await getTenantBranding(session.tenantId)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Company branding, GST config, support and more.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Branding</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-5">
          How your company appears to your team on the dashboard.
        </p>
        <BrandingForm
          initialDisplayName={branding.displayName}
          initialBackgroundUrl={branding.backgroundUrl}
        />
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Raise a support ticket</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-5">
          Something not working? Tell us and our team will reach out.
        </p>
        <SupportTicketForm />
      </section>
    </div>
  )
}
