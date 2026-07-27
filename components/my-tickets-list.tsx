import { cn } from '@/lib/utils'

export type MyTicket = {
  id: string
  subject: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  resolution: string | null
  created_at: string
  resolved_at: string | null
}

const statusColors: Record<MyTicket['status'], string> = {
  open: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  resolved: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300',
}

const priorityColors: Record<MyTicket['priority'], string> = {
  low: 'text-gray-500 dark:text-gray-400',
  normal: 'text-blue-600 dark:text-blue-400',
  high: 'text-amber-600 dark:text-amber-400',
  urgent: 'text-red-600 dark:text-red-400',
}

export function MyTicketsList({ tickets }: { tickets: MyTicket[] }) {
  if (tickets.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        You haven&apos;t raised any tickets yet.
      </p>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 dark:border-[var(--border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-[var(--surface-muted)] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Subject</th>
            <th className="text-left px-4 py-2 font-medium">Priority</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="text-left px-4 py-2 font-medium">Raised</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-[var(--border)]">
          {tickets.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                <div className="font-medium">{t.subject}</div>
                {t.resolution && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-md whitespace-pre-wrap">
                    <strong>Resolution:</strong> {t.resolution}
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className={cn('text-xs font-medium capitalize', priorityColors[t.priority])}>
                  {t.priority}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium capitalize', statusColors[t.status])}>
                  {t.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                {new Date(t.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
