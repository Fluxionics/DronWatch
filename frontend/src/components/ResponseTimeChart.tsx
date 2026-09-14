import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Check } from '../types'

interface Props {
  checks: Check[]
}

export default function ResponseTimeChart({ checks }: Props) {
  const data = checks
    .filter(c => c.response_time !== null)
    .slice(-100)
    .map(c => ({
      time: c.checked_at,
      ms: c.response_time
    }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={v => format(new Date(v), 'HH:mm')}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={v => `${v}ms`}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#34d399' }}
          labelFormatter={v => format(new Date(v), 'MMM d, HH:mm')}
          formatter={(v: number) => [`${v}ms`, 'Response time']}
        />
        <Line
          type="monotone"
          dataKey="ms"
          stroke="#10b981"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: '#10b981' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
