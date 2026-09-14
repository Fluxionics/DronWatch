import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMonitors } from '../hooks/useMonitors'
import { useUserStats } from '../hooks/useUser'
import MonitorCard from '../components/MonitorCard'
import { useAuthStore } from '../store/authStore'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import clsx from 'clsx'
import { SearchIcon } from '../components/icons'
import api from '../utils/api'
import toast from 'react-hot-toast'

type Filter = 'all' | 'up' | 'down' | 'paused'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'up', label: 'Up' },
  { key: 'down', label: 'Down' },
  { key: 'paused', label: 'Paused' }
]

export default function Dashboard() {
  useDocumentTitle('Dashboard · DronWatch')

  const { user } = useAuthStore()
  const { data: monitors, isLoading } = useMonitors()
  const { data: stats } = useUserStats()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (!monitors) return []
    const q = query.trim().toLowerCase()
    return monitors.filter(m => {
      if (filter === 'up' && m.last_status !== true) return false
      if (filter === 'down' && m.last_status !== false) return false
      if (filter === 'paused' && m.is_active) return false
      if (q && !m.name.toLowerCase().includes(q) && !m.url.toLowerCase().includes(q)) return false
      return true
    })
  }, [monitors, query, filter])

  const counts = useMemo(() => {
    const base = monitors ?? []
    return {
      all: base.length,
      up: base.filter(m => m.last_status === true).length,
      down: base.filter(m => m.last_status === false).length,
      paused: base.filter(m => !m.is_active).length
    }
  }, [monitors])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-50">
            {user?.username ? `${user.username}'s monitors` : 'Monitors'}
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">Track the health of your services</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            const { data } = await api.get('/api/monitors/export/all')
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'dronwatch-export.json'; a.click(); URL.revokeObjectURL(url)
          }} className="btn-ghost text-sm">Export</button>
          <label className="btn-ghost text-sm cursor-pointer">
            Import
            <input type="file" className="hidden" accept=".json" onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return
              try { const text = await file.text(); const json = JSON.parse(text); const payload = Array.isArray(json) ? json : json.monitors || []; await api.post('/api/monitors/import', { monitors: payload }); toast.success('Imported'); location.reload() } catch { toast.error('Import failed') }
            }} />
          </label>
          <Link to="/dashboard/monitors/new" className="btn-primary">New monitor</Link>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Online" value={stats.up} color="text-emerald-400" />
          <StatCard label="Down" value={stats.down} color={stats.down > 0 ? 'text-red-400' : undefined} />
          <StatCard label="Alerts this month" value={stats.alerts_this_month} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-600">
            <SearchIcon />
          </span>
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name or URL..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-1 bg-surface-900 border border-surface-800 rounded-lg p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                filter === f.key
                  ? 'bg-surface-800 text-surface-100'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs text-surface-600">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-44 bg-surface-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          {monitors?.length === 0 ? (
            <>
              <p className="text-surface-400 mb-4">No monitors yet.</p>
              <Link to="/dashboard/monitors/new" className="btn-primary">
                Create your first monitor
              </Link>
            </>
          ) : (
            <p className="text-surface-500 mb-1">No monitors match your search.</p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(monitor => (
            <MonitorCard key={monitor.id} monitor={monitor} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card py-4">
      <p className="text-xs text-surface-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-surface-50'}`}>{value}</p>
    </div>
  )
}