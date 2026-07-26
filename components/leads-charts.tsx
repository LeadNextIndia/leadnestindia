'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Lead = {
  id: string
  created_at: string
  status: string | null
  custom_data: Record<string, unknown> | null
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#f59e0b',
  qualified: '#6366f1',
  won: '#22c55e',
  lost: '#ef4444',
}

const DEFAULT_COLOR = '#94a3b8'

function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? DEFAULT_COLOR
}

function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

function last14Days(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function LeadsCharts({ leads }: { leads: Lead[] }) {
  const statusData = useMemo(() => {
    const counts = new Map<string, number>()
    leads.forEach((l) => {
      const s = (l.status ?? 'new').toLowerCase()
      counts.set(s, (counts.get(s) ?? 0) + 1)
    })
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
  }, [leads])

  const timelineData = useMemo(() => {
    const days = last14Days()
    const bucket = new Map<string, number>(days.map((d) => [d, 0]))
    leads.forEach((l) => {
      const day = isoDay(l.created_at)
      if (bucket.has(day)) bucket.set(day, (bucket.get(day) ?? 0) + 1)
    })
    return days.map((d) => ({
      day: d.slice(5), // MM-DD
      leads: bucket.get(d) ?? 0,
    }))
  }, [leads])

  const empty = leads.length === 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <ChartCard title="By status" subtitle="Distribution of current leads">
        {empty ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {statusData.map((d) => (
                  <Cell key={d.name} fill={statusColor(d.name)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {statusData.map((d) => (
            <span key={d.name} className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full" style={{ background: statusColor(d.name) }} />
              <span className="capitalize">{d.name}</span>
              <span className="text-gray-400">· {d.value}</span>
            </span>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Last 14 days" subtitle="New leads per day" className="lg:col-span-2">
        {empty ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <Tooltip cursor={{ stroke: 'var(--border)' }} />
              <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="By status (bar)" subtitle="Alternate breakdown" className="lg:col-span-3">
        {empty ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((d) => (
                  <Cell key={d.name} fill={statusColor(d.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-4 ${className ?? ''}`}
    >
      <div className="mb-2">
        <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{title}</div>
        {subtitle && <div className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
      No data yet.
    </div>
  )
}
