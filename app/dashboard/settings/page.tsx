import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/authz'
import { getTenantBranding } from '@/lib/branding'
import { createClient } from '@/lib/supabase/server'
import { BrandingForm } from '@/components/branding-form'
import { SupportTicketForm } from '@/components/support-ticket-form'
import { MyTicketsList, type MyTicket } from '@/components/my-tickets-list'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await requireAdmin()
  if (!session.tenantId) redirect('/dashboard')

  const branding = await getTenantBranding(session.tenantId)

  const supabase = await createClient()
  const { data: ticketsRaw } = await supabase
    .from('support_tickets')
    .select('id, subject, priority, status, resolution, created_at, resolved_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })
    .limit(30)

  const tickets: MyTicket[] = (ticketsRaw ?? []).map((t) => ({
    id: t.id as string,
    subject: t.subject as string,
    priority: t.priority as MyTicket['priority'],
    status: t.status as MyTicket['status'],
    resolution: (t.resolution as string | null) ?? null,
    created_at: t.created_at as string,
    resolved_at: (t.resolved_at as string | null) ?? null,
  }))

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Company branding, support tickets, and more.
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Support</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Something not working? Raise a ticket — we&apos;ll get back to you.
              {openCount > 0 && (
                <>
                  {' '}<span className="text-amber-700 dark:text-amber-400 font-medium">
                    {openCount} open ticket{openCount === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <SupportTicketForm />
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
            Your tickets
          </div>
          <MyTicketsList tickets={tickets} />
        </div>
      </section>
    </div>
  )
}
