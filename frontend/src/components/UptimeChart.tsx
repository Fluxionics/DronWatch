import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Check } from '../types'

interface Props {
  checks: Check[]
}

export default function UptimeChart({ checks }: Props) {
  const buckets = buildHourlyBuckets(checks)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="hour"
          tickFormatter={v => format(new Date(v), 'MMM d HH:mm')}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#60a5fa' }}
          labelFormatter={v => format(new Date(v), 'MMM d, HH:mm')}
          formatter={(v: number) => [`${v.toFixed(1)}%`, 'Uptime']}
        />
        <Area
          type="monotone"
          dataKey="uptime"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#uptimeGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function buildHourlyBuckets(checks: Check[]) {
  const map = new Map<string, { total: number; up: number }>()

  for (const check of checks) {
    const d = new Date(check.checked_at)
    d.setMinutes(0, 0, 0)
    const key = d.toISOString()
    const existing = map.get(key) || { total: 0, up: 0 }
    map.set(key, { total: existing.total + 1, up: existing.up + (check.is_up ? 1 : 0) })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, { total, up }]) => ({
      hour,
      uptime: total > 0 ? Math.round((up / total) * 1000) / 10 : 0
    }))
}
