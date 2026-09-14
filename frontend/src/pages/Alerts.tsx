import { formatDistanceToNow } from 'date-fns'
import { useAlerts } from '../hooks/useAlerts'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import clsx from 'clsx'

const typeColors: Record<string, string> = {
  email: 'text-brand-400 border-brand-500/40 bg-brand-500/10',
  slack: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  discord: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
  webhook: 'text-amber-400 border-amber-500/40 bg-amber-500/10'
}

export default function Alerts() {
  useDocumentTitle('Alerts · DronWatch')

  const { data, isLoading } = useAlerts()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-surface-50">Alerts</h1>
        <p className="text-sm text-surface-500 mt-0.5">Every notification sent when a service went down or recovered</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-14 bg-surface-800" />)}
        </div>
      ) : !data?.data || data.data.length === 0 ? (
        <div className="card text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center">
            <BellIcon />
          </div>
          <p className="text-surface-400 mb-1">No alerts yet</p>
          <p className="text-sm text-surface-600">You'll see email, Slack, Discord, and webhook alerts here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <ul className="divide-y divide-surface-800">
            {data.data.map(alert => (
              <li key={alert.id} className="flex items-start gap-4 px-5 py-4">
                <span className={clsx(
                  'w-2 h-2 rounded-full mt-2 shrink-0',
                  alert.is_sent ? 'bg-emerald-400' : 'bg-surface-600'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-surface-100">
                      {alert.monitors?.name || 'Unknown monitor'}
                    </span>
                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border', typeColors[alert.type])}>
                      {alert.type}
                    </span>
                    {!alert.is_sent && (
                      <span className="text-[11px] text-surface-500">queued</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 mb-1 font-mono break-words">{alert.message}</p>
                  <p className="text-xs text-surface-600">
                    To {alert.recipient} · {alert.sent_at
                      ? formatDistanceToNow(new Date(alert.sent_at), { addSuffix: true })
                      : 'not sent yet'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}