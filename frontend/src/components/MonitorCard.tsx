import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Monitor } from '../types'
import { useToggleMonitor, useDeleteMonitor } from '../hooks/useMonitors'
import clsx from 'clsx'

interface Props {
  monitor: Monitor
}

export default function MonitorCard({ monitor }: Props) {
  const toggle = useToggleMonitor()
  const remove = useDeleteMonitor()

  const statusLabel = monitor.last_status === null
    ? 'unknown'
    : monitor.last_status
      ? 'up'
      : 'down'

  const intervalLabel = (() => {
    const s = monitor.check_interval
    if (s < 60) return `${s}s`
    if (s < 3600) return `${s / 60}m`
    return `${s / 3600}h`
  })()

  const uptime = monitor.uptime_90d
  const series = monitor.uptime_series ?? []
  const upRatio = series.length > 0 ? series.filter(Boolean).length / series.length : null

  return (
    <div className={clsx('card flex flex-col gap-3 hover:border-surface-700 transition-all', !monitor.is_active && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-800 text-surface-400 border border-surface-700 uppercase">{monitor.type || 'http'}</span>
            {monitor.maintenance && <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">maintenance</span>}
          </div>
          <Link to={`/dashboard/monitors/${monitor.id}`} className="font-medium text-surface-50 hover:text-brand-400 transition-colors">
            {monitor.name}
          </Link>
          <p className="text-xs font-mono text-surface-500 truncate mt-0.5">{monitor.url}</p>
        </div>
        <span className={clsx(
          statusLabel === 'up' && 'badge-up',
          statusLabel === 'down' && 'badge-down',
          statusLabel === 'unknown' && 'badge-unknown'
        )}>
          <span className={clsx(
            'w-1.5 h-1.5 rounded-full',
            statusLabel === 'up' && 'bg-emerald-400',
            statusLabel === 'down' && 'bg-red-400',
            statusLabel === 'unknown' && 'bg-surface-500'
          )} />
          {statusLabel}
        </span>
      </div>

      {series.length > 0 && (
        <div className="flex gap-0.5 items-end h-6" title={`${Math.round((upRatio ?? 0) * 100)}% up`}>
          {series.map((isUp, i) => (
            <div
              key={i}
              className={clsx(
                'flex-1 rounded-sm',
                isUp ? 'bg-emerald-500/80' : 'bg-red-500/80'
              )}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-surface-500 flex-wrap">
        <span>Every {intervalLabel}</span>
        {uptime !== null && uptime !== undefined && (
          <span className={clsx('font-medium', uptime >= 99.9 ? 'text-emerald-400' : uptime >= 95 ? 'text-amber-400' : 'text-red-400')}>
            {uptime}% uptime (90d)
          </span>
        )}
        {monitor.last_check && (
          <span>Checked {formatDistanceToNow(new Date(monitor.last_check), { addSuffix: true })}</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-surface-800 -mx-1">
        <Link to={`/dashboard/monitors/${monitor.id}`} className="btn-ghost text-xs px-3 py-1.5">
          Details
        </Link>
        <Link to={`/dashboard/monitors/${monitor.id}/edit`} className="btn-ghost text-xs px-3 py-1.5">
          Edit
        </Link>
        <button
          onClick={() => toggle.mutate(monitor.id)}
          disabled={toggle.isPending}
          className="btn-ghost text-xs px-3 py-1.5 ml-auto"
        >
          {monitor.is_active ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${monitor.name}"?`)) remove.mutate(monitor.id)
          }}
          disabled={remove.isPending}
          className="btn-ghost text-xs px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          Delete
        </button>
      </div>
    </div>
  )
}