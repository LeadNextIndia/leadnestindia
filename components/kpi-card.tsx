import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: number | string
  hint?: string
  accent?: 'blue' | 'green' | 'amber' | 'gray' | 'red'
}

const accentMap: Record<NonNullable<Props['accent']>, string> = {
  blue:  'text-blue-600',
  green: 'text-green-600',
  amber: 'text-amber-600',
  red:   'text-red-600',
  gray:  'text-gray-700',
}

export function KpiCard({ label, value, hint, accent = 'gray' }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </div>
      <div className={cn('text-2xl font-semibold mt-1', accentMap[accent])}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>
      )}
    </div>
  )
}
