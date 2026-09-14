import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { useIncidents, useIncident, usePatchIncident, useIncidentAction, useIncidentUpdate, useIncidentTasks, useToggleTask, usePostmortem } from '../hooks/useIncidents'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import clsx from 'clsx'

const SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical']
const SEV_COLORS: Record<string, string> = {
  informational: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
  low: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  critical: 'border-red-500/40 bg-red-500/10 text-red-400'
}
const STATUS_COLORS: Record<string, string> = {
  open: 'border-red-500/40 bg-red-500/10 text-red-400',
  acknowledged: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  resolving: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  resolved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  closed: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  reopened: 'border-red-400/40 bg-red-400/10 text-red-300'
}

export default function Incidents() {
  useDocumentTitle('Incidents · DronWatch')
  const { data, isLoading } = useIncidents()
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')

  const filtered = (data || []).filter((inc: any) =>
    (!filter || inc.status === filter) && (!sevFilter || inc.severity === sevFilter)
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-surface-50">Incident management</h1>
        <p className="text-sm text-surface-500 mt-0.5">Full lifecycle: acknowledge, escalate, mitigate, postmortem</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['open', 'acknowledged', 'resolving', 'resolved', 'closed', 'reopened'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto text-sm" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? <div className="card animate-pulse h-24 bg-surface-800" /> : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="mx-auto w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p className="text-surface-400">No incidents</p><p className="text-xs text-surface-600 mt-1">Incidents are created automatically when a monitor goes down</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inc: any) => (
            <button key={inc.id} onClick={() => setSelected(inc.id)} className="card w-full text-left hover:border-surface-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', STATUS_COLORS[inc.status])}>{inc.status}</span>
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', SEV_COLORS[inc.severity])}>{inc.severity}</span>
                    {inc.tags?.map((t: string) => <span key={t} className="px-2 py-0.5 rounded text-xs bg-surface-800 text-surface-400 border border-surface-700">#{t}</span>)}
                  </div>
                  <p className="font-medium text-surface-100 mt-2">{inc.title}</p>
                  <p className="text-xs text-surface-500 mt-1">{inc.monitors?.name} · {formatDistanceToNow(new Date(inc.started_at), { addSuffix: true })} · {format(new Date(inc.started_at), 'MMM d, HH:mm')} · {Math.round((Date.now() - new Date(inc.started_at).getTime()) / 60000)}m elapsed</p>
                </div>
                <span className="text-surface-600 text-sm mt-1">Open</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <IncidentDetail id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function IncidentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: inc, isLoading } = useIncident(id)
  const patch = usePatchIncident()
  const action = useIncidentAction()
  const update = useIncidentUpdate()
  const addTask = useIncidentTasks()
  const toggleTask = useToggleTask()
  const postmortem = usePostmortem()
  const [publicMsg, setPublicMsg] = useState('')
  const [internalMsg, setInternalMsg] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [pm, setPm] = useState({ root_cause: '', timeline: '', actions: '' })

  if (isLoading || !inc) return null

  const open = ['open', 'acknowledged', 'resolving', 'reopened'].includes(inc.status)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-10" onClick={onClose}>
      <div className="card max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', STATUS_COLORS[inc.status])}>{inc.status}</span>
            {SEVERITIES.map(s => (
              <button key={s} onClick={() => patch.mutate({ id: inc.id, patch: { severity: s } })}
                className={clsx('px-2 py-0.5 rounded text-xs border', inc.severity === s ? SEV_COLORS[s] : 'border-surface-700 text-surface-500 hover:text-surface-300')}>{s}</button>
            ))}
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 text-xl leading-none">×</button>
        </div>

        <h2 className="text-lg font-bold text-surface-50">{inc.title}</h2>
        <p className="text-xs text-surface-500 mt-1">{inc.monitors?.name} · started {formatDistanceToNow(new Date(inc.started_at), { addSuffix: true })}</p>
        {inc.resolved_at && <p className="text-xs text-surface-500">resolved {formatDistanceToNow(new Date(inc.resolved_at), { addSuffix: true })} ({Math.round((new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime()) / 60000)}m)</p>}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="label">Assignee</label>
            <input className="input" placeholder="person@team" value={inc.assignee || ''} onChange={e => patch.mutate({ id: inc.id, patch: { assignee: e.target.value } })} />
          </div>
          <div>
            <label className="label">Tags (comma separated)</label>
            <input className="input" placeholder="db,backend,severe" defaultValue={(inc.tags || []).join(', ')}
              onBlur={e => patch.mutate({ id: inc.id, patch: { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {open && (<>
            <button className="btn-ghost text-xs" onClick={() => action.mutate({ id: inc.id, action: 'acknowledge' })}>Acknowledge</button>
            <button className="btn-ghost text-xs" onClick={() => action.mutate({ id: inc.id, action: 'investigating' })}>Investigating</button>
            <button className="btn-ghost text-xs" onClick={() => action.mutate({ id: inc.id, action: 'identified' })}>Root cause identified</button>
            <button className="btn-ghost text-xs" onClick={() => action.mutate({ id: inc.id, action: 'mitigating' })}>Mitigating</button>
            <button className="btn-ghost text-xs" onClick={() => action.mutate({ id: inc.id, action: 'monitoring' })}>Monitoring recovery</button>
            <button className="btn-primary text-xs" onClick={() => action.mutate({ id: inc.id, action: 'resolve' })}>Resolve</button>
            <button className="btn-ghost text-xs" onClick={() => action.mutate({ id: inc.id, action: 'reopen' })}>Reopen</button>
          </>)}
          <button className="btn-ghost text-xs ml-auto" onClick={() => action.mutate({ id: inc.id, action: 'close' })}>Close</button>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Public update</h3>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Status update shown on status page" value={publicMsg} onChange={e => setPublicMsg(e.target.value)} />
            <button className="btn-primary text-xs" onClick={() => { if (publicMsg) { update.mutate({ id: inc.id, payload: { message: publicMsg, status: inc.status, visibility: 'public' } }); setPublicMsg('') } }}>Post</button>
          </div>
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mt-4 mb-2">Internal note</h3>
          <div className="flex gap-2">
            <input className="input flex-1 bg-surface-800" placeholder="Internal only — for the team" value={internalMsg} onChange={e => setInternalMsg(e.target.value)} />
            <button className="btn-ghost text-xs" onClick={() => { if (internalMsg) { update.mutate({ id: inc.id, payload: { message: internalMsg, visibility: 'internal' } }); setInternalMsg('') } }}>Note</button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Timeline</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(inc.incident_updates || []).map((u: any) => (
              <div key={u.id} className="flex items-start gap-2 text-sm">
                <span className={clsx('mt-1.5 w-2 h-2 rounded-full shrink-0', u.visibility === 'internal' ? 'bg-amber-400' : 'bg-brand-400')} />
                <div className="min-w-0">
                  <p className="text-surface-300 break-words">{u.message}</p>
                  <p className="text-[11px] text-surface-600">{u.status} · {format(new Date(u.created_at), 'MMM d, HH:mm')} {u.visibility === 'internal' && <span className="text-amber-400">[internal]</span>}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Preventive tasks</h3>
          <div className="space-y-2">
            {(inc.incident_tasks || []).map((t: any) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                <input type="checkbox" className="accent-brand-500" checked={!!t.done} onChange={e => toggleTask.mutate({ id: t.id, done: e.target.checked })} />
                <span className={t.done ? 'line-through text-surface-500' : ''}>{t.title}</span>
              </label>
            ))}
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Add action item" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
              <button className="btn-ghost text-xs" onClick={() => { if (taskTitle) { addTask.mutate({ id: inc.id, title: taskTitle }); setTaskTitle('') } }}>Add</button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Postmortem</h3>
          <div className="space-y-2">
            <textarea className="input h-16" placeholder="Root cause" defaultValue={inc.postmortem?.root_cause || ''} onChange={e => setPm(p => ({ ...p, root_cause: e.target.value }))} />
            <textarea className="input h-16" placeholder="Timeline narrative" defaultValue={inc.postmortem?.timeline || ''} onChange={e => setPm(p => ({ ...p, timeline: e.target.value }))} />
            <textarea className="input h-16" placeholder="Preventive actions" defaultValue={inc.postmortem?.actions || ''} onChange={e => setPm(p => ({ ...p, actions: e.target.value }))} />
            <button className="btn-ghost text-xs" onClick={() => postmortem.mutate({ id: inc.id, payload: pm })}>Save postmortem</button>
          </div>
        </div>

        <button onClick={onClose} className="btn-ghost w-full mt-6">Close</button>
      </div>
    </div>
  )
}