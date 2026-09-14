import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useMonitor, useMonitorStats, useMonitorChecks, useDowntimeEvents, useDeleteMonitor, useToggleMonitor, useTestMonitor } from '../hooks/useMonitors'
import UptimeChart from '../components/UptimeChart'
import ResponseTimeChart from '../components/ResponseTimeChart'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import clsx from 'clsx'
import type { MonitorRegion } from '../types'
import api from '../utils/api'

export default function MonitorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const [exporting, setExporting] = useState(false)

  const { data: monitor, isLoading } = useMonitor(id!)
  useDocumentTitle(monitor ? `${monitor.name} · DronWatch` : 'Monitor · DronWatch')
  const { data: stats } = useMonitorStats(id!, days)
  const { data: checksData } = useMonitorChecks(id!)
  const { data: downtime } = useDowntimeEvents(id!)
  const remove = useDeleteMonitor()
  const toggle = useToggleMonitor()
  const test = useTestMonitor()

  const { data: report } = useQuery({
    queryKey: ['monitor-report', id],
    queryFn: async () => { const { data } = await api.get(`/api/monitors/${id}/report`); return data },
    enabled: !!id
  })
  const { data: regions } = useQuery<MonitorRegion[]>({
    queryKey: ['monitor-regions', id, days],
    queryFn: async () => {
      const { data } = await api.get(`/api/monitors/${id}/regions?days=${days}`)
      return data
    },
    enabled: !!id,
    refetchInterval: 60_000
  })
  const { data: security } = useQuery<any>({
    queryKey: ['monitor-security', id],
    queryFn: async () => { const { data } = await api.get(`/api/monitors/${id}/security`); return data },
    enabled: !!id,
    refetchInterval: 60_000
  })
  const [reporting, setReporting] = useState(false)

  const downloadReport = async (fmt: 'csv' | 'json') => {
    setReporting(true)
    try {
      const { data } = await api.get(`/api/monitors/${id}/report.${fmt}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${(monitor?.name ?? 'monitor').replace(/[^a-zA-Z0-9-_]+/g, '_')}.${fmt}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setReporting(false)
    }
  }

  if (isLoading) return <div className="animate-pulse h-64 card" />
  if (!monitor) return <p className="text-surface-400">Monitor not found.</p>

  const handleDelete = () => {
    if (confirm(`Delete "${monitor.name}"? This cannot be undone.`)) {
      remove.mutate(monitor.id, { onSuccess: () => navigate('/dashboard') })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data } = await api.get(`/api/monitors/${id}/checks?page=1&limit=500`)
      const checks = data.data ?? []
      if (checks.length === 0) {
        alert('No checks to export yet.')
        return
      }
      const header = 'checked_at,status,status_code,response_time_ms,error_message'
      const rows = checks.map((c: any) =>
        [c.checked_at, c.is_up ? 'up' : 'down', c.status_code ?? '', c.response_time ?? '', (c.error_message ?? '').replace(/"/g, '""')]
          .map(v => `"${v}"`)
          .join(',')
      )
      const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${monitor.name.replace(/[^a-zA-Z0-9-_]+/g, '_')}_checks.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const statusLabel = monitor.last_status === null ? 'unknown' : monitor.last_status ? 'up' : 'down'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-surface-500 hover:text-surface-300 transition-colors text-sm">
          Monitors
        </Link>
        <span className="text-surface-700">/</span>
        <span className="text-sm text-surface-300">{monitor.name}</span>
      </div>

      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-surface-50">{monitor.name}</h1>
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
          <p className="text-sm font-mono text-surface-500">{monitor.url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} disabled={exporting} className="btn-ghost text-sm">
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button onClick={() => downloadReport('csv')} disabled={reporting} className="btn-ghost text-sm">
            {reporting ? 'Downloading...' : 'Report CSV'}
          </button>
          <button onClick={() => downloadReport('json')} disabled={reporting} className="btn-ghost text-sm">
            {reporting ? 'Downloading...' : 'Report JSON'}
          </button>
          <button onClick={() => test.mutate(id!)} disabled={test.isPending} className="btn-ghost text-sm">
            {test.isPending ? 'Checking...' : 'Test now'}
          </button>
          <button onClick={() => toggle.mutate(id!)} disabled={toggle.isPending} className="btn-ghost text-sm">
            {monitor.is_active ? 'Pause' : 'Resume'}
          </button>
          <Link to={`/dashboard/monitors/${id}/edit`} className="btn-ghost text-sm">Edit</Link>
          <button onClick={handleDelete} disabled={remove.isPending} className="btn-danger text-sm">
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">Uptime</p>
          <p className="text-2xl font-bold text-surface-50">{stats?.uptime !== null && stats?.uptime !== undefined ? `${stats.uptime}%` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">Avg</p>
          <p className="text-2xl font-bold text-surface-50">{stats?.avgResponseTime ? `${stats.avgResponseTime}ms` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">p75</p>
          <p className="text-lg font-bold text-surface-50">{(stats as any)?.p75 ? `${(stats as any).p75}ms` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">p90</p>
          <p className="text-lg font-bold text-surface-50">{(stats as any)?.p90 ? `${(stats as any).p90}ms` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">p95</p>
          <p className="text-lg font-bold text-surface-50">{(stats as any)?.p95 ? `${(stats as any).p95}ms` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">p99</p>
          <p className="text-lg font-bold text-surface-50">{(stats as any)?.p99 ? `${(stats as any).p99}ms` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">p99.9</p>
          <p className="text-lg font-bold text-surface-50">{(stats as any)?.p99_9 !== undefined && (stats as any).p99_9 !== null ? `${(stats as any).p99_9}ms` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 mb-1">Error rate</p>
          <p className={clsx('text-2xl font-bold', (stats as any)?.errorRate ? 'text-red-400' : 'text-surface-50')}>{(stats as any)?.errorRate !== undefined ? `${(stats as any).errorRate}%` : '—'}</p>
        </div>
      </div>

      {stats && ((stats as any).avgDns !== undefined || (stats as any).avgTtfb !== undefined) && (
        <div className="card">
          <h2 className="font-semibold text-surface-100 mb-4">Request waterfall (avg, {days}d)</h2>
          {(() => {
            const steps = [
              { label: 'DNS', val: (stats as any).avgDns },
              { label: 'TCP', val: (stats as any).avgTcp },
              { label: 'TLS', val: (stats as any).avgTls },
              { label: 'TTFB', val: (stats as any).avgTtfb },
              { label: 'Total', val: (stats as any).avgResponseTime }
            ]
            const max = Math.max(...steps.map(s => s.val ?? 0), 1)
            return (
              <div className="space-y-2">
                {steps.filter(s => s.val !== null && s.val !== undefined).map(s => (
                  <div key={s.label} className="flex items-center gap-3 text-sm">
                    <span className="w-14 text-xs text-surface-500">{s.label}</span>
                    <div className="flex-1 h-3 bg-surface-800 rounded overflow-hidden">
                      <div className="h-full bg-brand-500/80 rounded" style={{ width: `${Math.max((s.val ?? 0) / max * 100, 2)}%` }} />
                    </div>
                    <span className="w-14 text-right font-mono text-xs text-surface-400">{Math.round(s.val)}ms</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-surface-100">Uptime</h2>
          <div className="flex gap-1">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={clsx(
                  'px-2.5 py-1 rounded text-xs transition-colors',
                  days === d
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {stats?.checks && stats.checks.length > 0 ? (
          <UptimeChart checks={stats.checks} />
        ) : (
          <p className="text-sm text-surface-500 py-8 text-center">No data yet</p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-surface-100 mb-4">Response time</h2>
        {checksData?.data && checksData.data.length > 0 ? (
          <ResponseTimeChart checks={checksData.data} />
        ) : (
          <p className="text-sm text-surface-500 py-8 text-center">No data yet</p>
        )}
      </div>

      {regions && regions.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-surface-100 mb-4">Regions</h2>
          <div className="space-y-1">
            {regions.map(region => (
              <div key={region.code} className="flex items-center gap-3 py-1.5 text-sm border-b border-surface-800 last:border-0">
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  region.last_status === true ? 'bg-emerald-400' : region.last_status === false ? 'bg-red-400' : 'bg-surface-600'
                )} />
                <span className="font-mono text-xs uppercase text-surface-400 w-10">{region.code}</span>
                <span className="text-surface-200">{region.label}</span>
                <span className="text-xs text-surface-500 ml-auto font-mono">{region.last_latency !== null && region.last_latency !== undefined ? `${region.last_latency}ms` : '—'}</span>
                <span className="text-xs text-surface-500 w-20 text-right">{region.uptime_24h !== null && region.uptime_24h !== undefined ? `${region.uptime_24h}%` : '—'}</span>
                <span className="text-xs text-surface-600 w-24 text-right">
                  {region.last_check ? formatDistanceToNow(new Date(region.last_check), { addSuffix: true }) : 'never'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {security && security.score && (
        <div className="card">
          <h2 className="font-semibold text-surface-100 mb-4">Security Inspector</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${security.score === 'A+' || security.score === 'A' ? 'bg-emerald-500/20 text-emerald-400' : security.score === 'B' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{security.score}</div>
            <div>
              <p className="text-sm text-surface-200">{security.summary}</p>
              <p className="text-xs text-surface-500">Grade {security.grade}% · {security.checked_at ? formatDistanceToNow(new Date(security.checked_at), { addSuffix: true }) : ''}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {security.checks?.map((c: any) => (
              <div key={c.name} className="flex items-center gap-2 text-xs border border-surface-800 rounded px-2 py-1.5">
                <span className={c.pass ? 'text-emerald-400' : 'text-red-400'}>{c.pass ? '✓' : '✗'}</span>
                <span className="font-medium text-surface-300">{c.name}</span>
                <span className="text-surface-500 truncate ml-auto font-mono text-[11px]">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {downtime && downtime.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-surface-100 mb-4">Downtime events</h2>
          <div className="space-y-2">
            {downtime.map((event, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-surface-800 last:border-0 text-sm">
                <span className="text-red-400 font-medium">Down</span>
                <span className="text-surface-400">{format(new Date(event.startedAt), 'MMM d, HH:mm')}</span>
                <span className="text-surface-600">to</span>
                <span className="text-surface-400">
                  {event.resolvedAt ? format(new Date(event.resolvedAt), 'MMM d, HH:mm') : 'Ongoing'}
                </span>
                {event.duration && (
                  <span className="text-surface-500 ml-auto">
                    {event.duration < 60
                      ? `${event.duration}s`
                      : event.duration < 3600
                        ? `${Math.round(event.duration / 60)}m`
                        : `${Math.round(event.duration / 3600)}h`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report && (
        <div className="card space-y-6">
          <h2 className="font-semibold text-surface-100">Service report</h2>

          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">Uptime windows</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {Object.entries(report.windows || {}).map(([label, val]) => (
                <div key={label} className="rounded-lg bg-surface-800 p-3 text-center">
                  <p className="text-[11px] text-surface-500">{label}</p>
                  <p className="text-sm font-bold text-surface-100">{val !== null ? `${val}%` : '—'}</p>
                  {(report as any).downtimeMs?.[label] !== undefined && (report as any).downtimeMs[label] !== null && (
                    <p className="text-[10px] text-surface-600 mt-1">{formatMs((report as any).downtimeMs[label])} down</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {(report as any).slaAllowedMs && (
            <div>
              <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">SLA calculator — {report.slaTarget}% target</p>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-surface-500"><th className="text-left py-1">Window</th><th className="text-right py-1">Allowed</th><th className="text-right py-1">Actual down</th><th className="text-right py-1">Status</th></tr></thead>
                  <tbody>
                    {Object.keys(report.windows || {}).map(label => {
                      const allowed = (report as any).slaAllowedMs?.[label]
                      const actual = (report as any).downtimeMs?.[label]
                      const ok = actual !== null && allowed !== null ? actual <= allowed : null
                      return (
                        <tr key={label} className="border-t border-surface-800">
                          <td className="py-1.5 font-mono text-surface-300">{label}</td>
                          <td className="py-1.5 text-right font-mono text-surface-400">{allowed !== null ? formatMs(allowed) : '—'}</td>
                          <td className="py-1.5 text-right font-mono text-surface-400">{actual !== null ? formatMs(actual) : '—'}</td>
                          <td className={`py-1.5 text-right font-medium ${ok === null ? 'text-surface-600' : ok ? 'text-emerald-400' : 'text-red-400'}`}>{ok === null ? '—' : ok ? '✅ PASS' : '❌ BREACH'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-4 gap-4">
            <Stat label="Error budget" value={report.errorBudget !== null ? `${report.errorBudget > 0 ? '+' : ''}${report.errorBudget}%` : '—'} tone={report.errorBudget !== null && (report.errorBudget as number) < 0 ? 'text-red-400' : undefined} />
            <Stat label="SLA target" value={report.slaTarget ? `${report.slaTarget}%` : '—'} />
            <Stat label="MTTA" value={report.mtta !== null ? `${report.mtta} min` : '—'} />
            <Stat label="MTTR" value={report.mttr !== null ? `${report.mttr} min` : '—'} />
            <Stat label="MTBF" value={(report as any).mtbf !== null && (report as any).mtbf !== undefined ? `${(report as any).mtbf} min` : '—'} />
            <Stat label="Availability (90d)" value={(report as any).availability !== null && (report as any).availability !== undefined ? `${(report as any).availability}%` : report.windows?.['90d'] !== null ? `${report.windows['90d']}%` : '—'} />
            <Stat label="Avg size" value={(report.stats as any)?.avgResponseSize ? `${(report.stats as any).avgResponseSize} B` : '—'} />
            <Stat label="Success rate" value={(report.stats as any)?.successRate !== null ? `${(report.stats as any).successRate}%` : '—'} />
          </div>

          {report.daily && report.daily.length > 0 && (
            <div>
              <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">Daily uptime (90 days)</p>
              <div className="flex items-end gap-0.5 h-16">
                {report.daily.map((d: any) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.uptime}% uptime${d.avg !== null ? ` · ${d.avg}ms avg` : ''}`}
                    className={clsx(
                      'flex-1 rounded-sm min-w-[2px]',
                      d.uptime >= 99.5 ? 'bg-emerald-500' : d.uptime >= 95 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ height: `${Math.max(d.uptime, 2)}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {report.errorsByCode && Object.keys(report.errorsByCode).length > 0 && (
            <div>
              <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">Status codes observed</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.errorsByCode as any).map(([code, count]) => (
                  <span key={code} className="rounded-full bg-surface-800 px-2.5 py-1 text-xs font-mono text-surface-300">{code} × {String(count)}</span>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-surface-500">Report period: last 90 days. Full exports available as CSV and JSON.</div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-surface-100 mb-4">Recent checks</h2>
        <div className="space-y-1">
          {checksData?.data?.slice(0, 20).map(check => (
            <div key={check.id} className="flex items-center gap-3 py-1.5 text-xs">
              <span className={check.is_up ? 'text-emerald-400' : 'text-red-400'}>
                {check.is_up ? 'UP' : 'DOWN'}
              </span>
              {check.status_code && <span className="text-surface-500 font-mono">{check.status_code}</span>}
              {check.response_time && <span className="text-surface-500">{check.response_time}ms</span>}
              <span className="text-surface-600 ml-auto">
                {formatDistanceToNow(new Date(check.checked_at), { addSuffix: true })}
              </span>
              {check.error_message && (
                <span className="text-red-400 truncate max-w-48">{check.error_message}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatMs(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`
  return `${(ms / 86400000).toFixed(1)}d`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-800 p-3">
      <p className="text-[11px] text-surface-500 mb-1">{label}</p>
      <p className={clsx('text-sm font-bold text-surface-100', tone)}>{value}</p>
    </div>
  )
}
