import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: number | string
  hint?: string
  accent?: 'blue' | 'green' | 'amber' | 'gray' | 'red'
}

const accentMap: Record<NonNullable<Props['accent']>, { text: string; bar: string; glow: string }> = {
  blue:  {
    text: 'text-blue-600 dark:text-blue-400',
    bar:  'from-blue-500 to-indigo-500',
    glow: 'group-hover:shadow-blue-500/20',
  },
  green: {
    text: 'text-green-600 dark:text-emerald-400',
    bar:  'from-emerald-500 to-teal-500',
    glow: 'group-hover:shadow-emerald-500/20',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    bar:  'from-amber-500 to-orange-500',
    glow: 'group-hover:shadow-amber-500/20',
  },
  red:   {
    text: 'text-red-600 dark:text-red-400',
    bar:  'from-rose-500 to-red-500',
    glow: 'group-hover:shadow-rose-500/20',
  },
  gray:  {
    text: 'text-gray-800 dark:text-gray-100',
    bar:  'from-slate-400 to-slate-600',
    glow: 'group-hover:shadow-slate-500/15',
  },
}

export function KpiCard({ label, value, hint, accent = 'gray' }: Props) {
  const a = accentMap[accent]
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-[var(--border)]',
        'bg-white/70 dark:bg-[var(--surface)]/80 backdrop-blur-sm px-4 py-3.5',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        a.glow,
      )}
    >
      {/* Accent bar */}
      <div className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-80', a.bar)} />
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 font-semibold">
        {label}
      </div>
      <div className={cn('text-3xl font-bold mt-1.5 tabular-nums leading-none', a.text)}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">{hint}</div>
      )}
    </div>
  )
}
