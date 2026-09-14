import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { usePublicStatusPage, usePublicStatusPageByDomain } from '../hooks/useStatusPages'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import api, { apiRoot } from '../utils/api'
import clsx from 'clsx'

function isCustomHost(): boolean {
  const raw = (import.meta.env.VITE_CANONICAL_HOST || '').trim().toLowerCase()
  if (!raw) return false
  let canonical = raw
  try { canonical = new URL(raw).hostname } catch { /* keep raw */ }
  const host = window.location.hostname.toLowerCase()
  return host !== canonical && host !== 'localhost' && host !== '127.0.0.1'
}

type PublicPage = any

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>()
  const customHost = isCustomHost()
  const domain = customHost ? window.location.hostname : ''
  const { data: slugData, isLoading: slugLoading, error: slugError } = usePublicStatusPage(slug || '')
  const { data: domainData, isLoading: domainLoading, error: domainError } = usePublicStatusPageByDomain(domain)
  const data: PublicPage | undefined = customHost ? domainData : slugData
  const isLoading = customHost ? domainLoading : slugLoading
  const error = customHost ? domainError : slugError

  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subError, setSubError] = useState('')
  const params = new URLSearchParams(window.location.search)
  const verified = params.get('verified') === '1'
  const unsubscribed = params.get('unsubscribed') === '1'
  useDocumentTitle(data ? `${data.name} · DronWatch` : 'Status · DronWatch')

  const subscribe = async () => {
    setSubError('')
    try {
      const { data: res } = await api.post(`/api/status-pages/public/${data.slug}/subscribe`, { email })
      if (res.ok) setSubscribed(true)
    } catch (err: any) {
      setSubError(err.response?.data?.error || 'Subscription failed')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <p className="text-surface-500">Loading...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center gap-6">
        <div className="max-w-sm w-full">
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 text-center">
            <p className="text-surface-300 text-sm">Status page not found or private.</p>
            <p className="text-xs text-surface-500 mt-2">If this page is password protected, append <code className="font-mono">?password=your-password</code> to the URL.</p>
          </div>
        </div>
      </div>
    )
  }

  const monitors: any[] = data.monitors || []
  const allUp = monitors.length > 0 && monitors.every((m: any) => m.last_status === true)
  const anyDown = monitors.some((m: any) => m.last_status === false)
  const incidents: any[] = data.incidents || []

  return (
    <div className="min-h-screen" style={{ backgroundColor: data.background_color }}>
      <div className="max-w-3xl mx-auto px-5 py-12">
        <header className="mb-10">
          {data.description && (
            <p className="text-surface-400 text-sm mb-3">{data.description}</p>
          )}
          <h1 className="text-2xl font-bold text-surface-50 mb-1">{data.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <a
              href={`${apiRoot()}/status-pages/feed/${data.slug}`}
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 17.95 7.38 18 6.18 18c-1.2 0-2.18-.05-2.18-2.18a2.18 2.18 0 0 1 2.18-2.18zM4.45 4.26c.89 0 1.78.07 2.66.21 5.4.85 9.13 4.58 9.98 9.98.14.88.21 1.77.21 2.66 0 .76-2.06.61-2.06-.62 0-1.09-.07-2.17-.31-3.24a11.62 11.62 0 0 0-8.26-8.26c-1.07-.24-2.15-.31-3.24-.31-.72 0-1.78-.62-1.78-.62 0 0 1.18-2.06 2.81-1.78zM4.45 0a19.83 19.83 0 0 1 3.79.34c6.14 1.21 11 6.07 12.16 12.16.23 1.23.34 2.49.34 3.79 0 .76-1.02.76-1.02 0 0-9.03-6.48-16.57-15.27-16.57-.76 0-.76-1.02 0-1.02zm.02 8.21c.74 0 1.48.06 2.21.18 4.44.88 7.5 3.95 8.37 8.38.12.73.18 1.47.18 2.21 0 .76-1.02.76-1.02 0 0-6.52-5.22-11.75-11.75-11.75-.76 0-.76-1.02 0-1.02z" />
              </svg>
              RSS Feed
            </a>
            <span className="text-xs text-surface-600">This page may not reflect all services that might be experiencing issues.</span>
          </div>
        </header>

        {verified && (
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-900/20 px-5 py-3 mb-4 text-sm text-emerald-300">
            Email subscription verified. You will be notified when services change status.
          </div>
        )}

        {unsubscribed && (
          <div className="rounded-xl border border-surface-800 bg-surface-900/60 px-5 py-3 mb-4 text-sm text-surface-300">
            You have been unsubscribed from updates for this page.
          </div>
        )}

        <div className={clsx(
          'rounded-xl border px-5 py-4 mb-8 flex items-center gap-3',
          anyDown
            ? 'border-red-800/50 bg-red-900/20'
            : allUp
              ? 'border-emerald-800/50 bg-emerald-900/20'
              : 'border-surface-800 bg-surface-900/50'
        )}>
          <span className={clsx(
            'w-2.5 h-2.5 rounded-full',
            anyDown ? 'bg-red-400' : allUp ? 'bg-emerald-400' : 'bg-surface-500'
          )} />
          <span className={clsx(
            'font-semibold',
            anyDown ? 'text-red-300' : allUp ? 'text-emerald-300' : 'text-surface-300'
          )}>
            {anyDown
              ? 'Some services are experiencing issues'
              : allUp
                ? 'All systems operational'
                : 'Status unknown'}
          </span>
        </div>

        {data.maintenance?.length > 0 && (
          <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 px-5 py-3 mb-8">
            <p className="text-xs font-medium text-amber-300 uppercase tracking-wide mb-1">Scheduled maintenance</p>
            <ul className="space-y-1">
              {data.maintenance.map((m: any) => (
                <li key={m.id} className="text-sm text-amber-100 flex justify-between gap-4">
                  <span>{m.message || m.title}</span>
                  <span className="text-xs text-amber-400 shrink-0">
                    {formatDistanceToNow(new Date(m.starts_at), { addSuffix: true })} · {formatDistanceToNow(new Date(m.ends_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {monitors.map((monitor: any) => (
            <MonitorRow key={monitor.id} monitor={monitor} />
          ))}
        </div>

        {incidents.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wide mb-3">Incident history</h2>
            <div className="space-y-3">
              {incidents.map(incident => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
            </div>
          </div>
        )}

        {data.subscriptions_enabled && (
          <div className="mt-8 rounded-xl border border-surface-800 bg-surface-900/60 px-5 py-4">
            <p className="text-sm font-medium text-surface-200 mb-2">Subscribe to updates</p>
            {subscribed ? (
              <p className="text-sm text-emerald-300">Subscribed! If subscriptions require email verification you will receive a link shortly.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="flex-1 bg-surface-950 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:border-brand-500 focus:outline-none"
                  />
                  <button onClick={subscribe} className="bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-lg px-4 transition-colors">Subscribe</button>
                </div>
                {subError && <p className="text-xs text-red-400 mt-2">{subError}</p>}
              </>
            )}
          </div>
        )}

        <footer className="mt-12 text-xs text-surface-600 flex items-center justify-between">
          <span>
            Updated {monitors[0]?.last_check
              ? formatDistanceToNow(new Date(monitors[0].last_check), { addSuffix: true })
              : 'never'}
          </span>
          {data.branding_default && (
            <a href="/" className="hover:text-surface-400 transition-colors">Powered by DronWatch</a>
          )}
        </footer>
      </div>
    </div>
  )
}

function MonitorRow({ monitor }: { monitor: any }) {
  const status = monitor.last_status === null
    ? 'unknown'
    : monitor.last_status
      ? 'up'
      : 'down'

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/60 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium text-surface-100">{monitor.name}</p>
          <p className="text-xs font-mono text-surface-500 mt-0.5">{monitor.url}</p>
        </div>
        <div className="flex items-center gap-3">
          {monitor.uptime !== null && (
            <span className="text-sm text-surface-400">{monitor.uptime}% uptime</span>
          )}
          <span className={clsx(
            status === 'up' && 'badge-up',
            status === 'down' && 'badge-down',
            status === 'unknown' && 'badge-unknown'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              status === 'up' && 'bg-emerald-400',
              status === 'down' && 'bg-red-400',
              status === 'unknown' && 'bg-surface-500'
            )} />
            {status}
          </span>
        </div>
      </div>

      {monitor.recent_checks.length > 0 && (
        <div className="flex gap-0.5 h-7">
          {monitor.recent_checks.map((check: any, i: number) => (
            <div
              key={i}
              title={check.is_up ? 'Up' : 'Down'}
              className={clsx(
                'flex-1 rounded-sm transition-opacity hover:opacity-80',
                check.is_up ? 'bg-emerald-500' : 'bg-red-500'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function incidentLabel(incident: any): { text: string; tone: string } {
  const updates = (incident.incident_updates || [])
    .filter((u: any) => u.visibility !== 'internal')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const status = updates[0]?.status || (incident.status === 'resolved' ? 'resolved' : 'investigating')
  const map: Record<string, { text: string; tone: string }> = {
    investigating: { text: 'Investigating', tone: 'bg-amber-500' },
    identified: { text: 'Identified', tone: 'bg-orange-500' },
    monitoring: { text: 'Monitoring', tone: 'bg-sky-500' },
    resolved: { text: 'Resolved', tone: 'bg-emerald-500' },
    maintenance: { text: 'Maintenance', tone: 'bg-purple-500' },
    acknowledged: { text: 'Acknowledged', tone: 'bg-orange-500' },
    open: { text: 'Investigating', tone: 'bg-amber-500' },
    closed: { text: 'Resolved', tone: 'bg-emerald-500' }
  }
  return map[status] || { text: status, tone: 'bg-surface-500' }
}

function IncidentRow({ incident }: { incident: any }) {
  const label = incidentLabel(incident)
  const latest = (incident.incident_updates || [])
    .filter((u: any) => u.visibility !== 'internal')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const resolved = incident.status === 'resolved'
  const by = formatDistanceToNow(new Date(latest?.created_at || incident.started_at), { addSuffix: true })

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/60 px-5 py-4">
      <div className="flex items-center gap-3 mb-1">
        <span className={clsx('w-2 h-2 rounded-full shrink-0', label.tone)} />
        <h3 className="font-medium text-surface-100 flex-1">{incident.title}</h3>
        <span className={clsx(
          'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border',
          resolved
            ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-300'
            : 'border-amber-600/40 bg-amber-600/10 text-amber-300'
        )}>
          {label.text}
        </span>
      </div>
      <p className="text-xs text-surface-500 pl-5">
        Started {formatDistanceToNow(new Date(incident.started_at), { addSuffix: true })}
        {resolved && incident.resolved_at && (
          <> · Resolved {formatDistanceToNow(new Date(incident.resolved_at), { addSuffix: true })}</>
        )}
        {latest && ` · Updated ${by}`}
      </p>
      {latest && (
        <p className="text-sm text-surface-300 pl-5 mt-2">{latest.message}</p>
      )}
    </div>
  )
}