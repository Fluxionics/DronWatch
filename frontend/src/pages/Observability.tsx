import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Observability() {
  useDocumentTitle('Observability · DronWatch')
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-surface-50">Observability</h1>
        <p className="text-sm text-surface-500 mt-0.5">Server agents, host metrics, logs and pattern alerts</p>
      </div>
      <AgentsSection />
      <LogsSection />
    </div>
  )
}

function AgentsSection() {
  const qc = useQueryClient()
  const { data: agents, isLoading } = useQuery({ queryKey: ['agents'], queryFn: async () => { const { data } = await api.get('/api/agents'); return data } })
  const [name, setName] = useState('')
  const [createdToken, setCreatedToken] = useState<{ id: string; token: string; name: string } | null>(null)

  const create = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/agents', { name }); return data },
    onSuccess: (data) => { toast.success('Agent created'); setCreatedToken(data); setName(''); qc.invalidateQueries({ queryKey: ['agents'] }) },
    onError: () => toast.error('Failed to create agent')
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/agents/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] })
  })

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-surface-100">Server agents</h2>
      <p className="text-sm text-surface-400">A small Node script reports CPU, memory, load, processes and containers every 30 seconds using outbound HTTPS only — no open ports.</p>

      <div className="grid sm:grid-cols-2 gap-2">
        <input className="input" placeholder="Server name, e.g. prod-web-01" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn-primary" onClick={() => name.trim() && create.mutate()} disabled={create.isPending || !name.trim()}>Create agent</button>
      </div>

      {createdToken && (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-900/20 p-4">
          <p className="text-xs text-emerald-300 mb-2 font-medium">{createdToken.name} created. Run this to install (Node 16+):</p>
          <div className="flex gap-2">
            <code className="flex-1 font-mono text-xs text-surface-100 bg-surface-950 rounded px-3 py-2 break-all select-all">
              npx dronwatch-agent {createdToken.token}
            </code>
            <button onClick={() => navigator.clipboard.writeText(`npx dronwatch-agent ${createdToken.token}`)} className="btn-ghost text-xs">Copy</button>
          </div>
          <p className="text-xs text-surface-500 mt-2">Skip the token to use the generated script on this server instead.</p>
        </div>
      )}

      {isLoading ? <div className="animate-pulse h-20 bg-surface-800 rounded-lg" /> : agents && agents.length > 0 && (
        <div className="space-y-2">
          {(agents as any[]).map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-900 p-3">
              <div className={`w-2.5 h-2.5 rounded-full ${a.last_seen && Date.now() - new Date(a.last_seen).getTime() < 90000 ? 'bg-emerald-400' : 'bg-surface-600'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-200">{a.name}</p>
                <p className="text-xs text-surface-500">created {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}{a.last_seen && ` · last seen ${formatDistanceToNow(new Date(a.last_seen), { addSuffix: true })}`}</p>
                {a.last_stats && (
                  <>
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px] font-mono text-surface-400">
                      <span>CPU {a.last_stats.cpu ?? '-'}%</span>
                      <span>MEM {a.last_stats.mem ?? '-'}%</span>
                      <span>DISK {a.last_stats.disk ?? '-'}%</span>
                      <span>LOAD {a.last_stats.load ?? '-'}</span>
                      <span>PROC {a.last_stats.processes ?? '-'}</span>
                      <span>UP {a.last_stats.uptime ? `${Math.floor(a.last_stats.uptime/3600)}h` : '-'}</span>
                      {a.last_stats.temperature !== null && a.last_stats.temperature !== undefined && <span>TEMP {a.last_stats.temperature}°C</span>}
                    </div>
                    {a.last_stats.services && Array.isArray(a.last_stats.services) && a.last_stats.services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {a.last_stats.services.map((svc: any, i: number) => (
                          <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${svc.status === 'up' ? 'border-emerald-800 bg-emerald-900/30 text-emerald-300' : 'border-red-800 bg-red-900/30 text-red-300'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${svc.status === 'up' ? 'bg-emerald-400' : 'bg-red-400'}`} />{svc.name}:{svc.port}
                          </span>
                        ))}
                      </div>
                    )}
                    {a.last_stats.extra?.docker && Array.isArray(a.last_stats.extra.docker) && a.last_stats.extra.docker.length > 0 && (
                      <div className="mt-1.5 rounded border border-surface-800 bg-surface-950 p-2">
                        <p className="text-[11px] font-semibold text-surface-300 mb-1">Docker — {a.last_stats.extra.docker.length} containers</p>
                        <div className="space-y-1 max-h-32 overflow-auto">
                          {a.last_stats.extra.docker.slice(0, 8).map((c: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                              <span className={`w-1.5 h-1.5 rounded-full ${c.state === 'running' ? 'bg-emerald-400' : 'bg-surface-600'}`} />
                              <span className="text-surface-300 truncate">{c.name}</span>
                              <span className="text-surface-600 truncate">{c.image}</span>
                              <span className="text-surface-500 ml-auto truncate">{c.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <button onClick={() => remove.mutate(a.id)} className="btn-ghost text-xs text-red-400">Remove</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function LogsSection() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('')
  const [live, setLive] = useState(false)
  const { data: logs } = useQuery({
    queryKey: ['logs', q, level],
    queryFn: async () => { const { data } = await api.get('/api/logs/search', { params: { q, level, limit: 100 } }); return data },
    refetchInterval: live ? 2000 : false
  })
  const { data: levels } = useQuery({ queryKey: ['log-levels'], queryFn: async () => { const { data } = await api.get('/api/logs/levels'); return data } })

  const ingest = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/logs/ingest', [{ service: 'demo', level: 'warning', message: 'Demo log entry from dashboard' }, { service: 'demo', level: 'info', message: 'Demo: heartbeat ok' }]); return data },
    onSuccess: () => { toast.success('Demo logs ingested'); qc.invalidateQueries({ queryKey: ['logs'] }); qc.invalidateQueries({ queryKey: ['log-levels'] }) }
  })

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-surface-100">Log search</h2>
      <p className="text-sm text-surface-400">Ingest logs via <code className="text-brand-400 font-mono text-xs">POST /api/logs/ingest?api_key=YOUR_KEY</code> with JSON bodies, then search below.</p>
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 min-w-[180px]" placeholder="Search message... (e.g. error)" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={level} onChange={e => setLevel(e.target.value)}>
          <option value="">All levels</option>
          {['debug', 'info', 'warning', 'error', 'critical'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className={`text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${live ? 'bg-emerald-500/20 border-emerald-800 text-emerald-300' : 'btn-ghost'}`} onClick={() => setLive(!live)}>{live ? '● Live' : '○ Live tail'}</button>
        <button className="btn-ghost text-xs" onClick={() => ingest.mutate()} disabled={ingest.isPending}>{ingest.isPending ? 'Sending...' : 'Send demo logs'}</button>
      </div>
      {levels && Object.keys(levels).length > 0 && (
        <div className="flex gap-2 text-xs text-surface-400">
          {(Object.entries(levels as any) as [string, number][]).map(([k, v]) => <span key={k} className="rounded-full bg-surface-800 px-2 py-0.5">{k}: {v}</span>)}
        </div>
      )}
      <div className="rounded-lg bg-surface-950 border border-surface-800 overflow-auto max-h-80">
        {!logs || logs.length === 0 ? (
          <p className="p-4 text-xs text-surface-600">No logs yet. Configure an agent or POST entries via the API.</p>
        ) : (
          (logs as any[]).map((l: any) => (
            <div key={l.id} className="flex items-start gap-3 px-3 py-2 border-b border-surface-900 text-xs font-mono hover:bg-surface-900">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.level === 'error' ? 'bg-red-900/40 text-red-400' : l.level === 'warning' ? 'bg-amber-900/40 text-amber-400' : 'bg-surface-800 text-surface-400'}`}>{l.level}</span>
              <span className="text-surface-600">{new Date(l.ts).toLocaleTimeString()}</span>
              <span className="text-brand-400">{l.service || 'app'}</span>
              <span className="text-surface-300 break-all flex-1">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}