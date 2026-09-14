import { useState } from 'react'
import { format } from 'date-fns'
import { useMaintenance, useCreateMaintenance, useDeleteMaintenance, useSilences, useCreateSilence } from '../hooks/useIncidents'
import { useMonitors } from '../hooks/useMonitors'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Maintenance() {
  useDocumentTitle('Maintenance · DronWatch')
  const { data: windows } = useMaintenance()
  const { data: silences } = useSilences()
  const { data: monitors } = useMonitors()
  const create = useCreateMaintenance()
  const remove = useDeleteMaintenance()
  const createSilence = useCreateSilence()
  const [form, setForm] = useState({ title: '', monitor_ids: [] as string[], starts_at: '', ends_at: '' })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate({ ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() }, { onSuccess: () => setForm({ title: '', monitor_ids: [], starts_at: '', ends_at: '' }) })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-surface-50">Maintenance</h1>
        <p className="text-sm text-surface-500 mt-0.5">Schedule windows and silence alerts</p>
      </div>

      <form onSubmit={handleCreate} className="card space-y-4">
        <h2 className="font-semibold text-surface-100">New window</h2>
        <input className="input" placeholder="Deploy window" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="datetime-local" className="input" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} required />
          <input type="datetime-local" className="input" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <p className="label">Monitors (empty = all)</p>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-32 overflow-auto">
            {(monitors || []).map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm text-surface-300">
                <input type="checkbox" checked={form.monitor_ids.includes(m.id)} onChange={e => setForm(f => ({ ...f, monitor_ids: e.target.checked ? [...f.monitor_ids, m.id] : f.monitor_ids.filter(x => x !== m.id) }))} />
                {m.name}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={create.isPending} className="btn-primary">Schedule</button>
      </form>

      <div className="card space-y-3">
        <h2 className="font-semibold text-surface-100">Upcoming windows</h2>
        {(windows || []).length === 0 ? <p className="text-sm text-surface-500">No windows scheduled</p> : windows!.map((w: any) => (
          <div key={w.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
            <div>
              <p className="text-sm text-surface-100">{w.title}</p>
              <p className="text-xs text-surface-500">{format(new Date(w.starts_at), 'MMM d HH:mm')} - {format(new Date(w.ends_at), 'MMM d HH:mm')}</p>
            </div>
            <button onClick={() => remove.mutate(w.id)} className="btn-ghost text-xs text-red-400">Delete</button>
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-surface-100">Silence alerts</h2>
        <button onClick={() => createSilence.mutate({ ends_at: new Date(Date.now() + 3600 * 1000).toISOString() })} className="btn-ghost text-sm">Silence all for 1 hour</button>
        {(silences || []).map((s: any) => (
          <div key={s.id} className="text-xs text-surface-500 font-mono">{s.monitor_id || 'all'} until {format(new Date(s.ends_at), 'MMM d HH:mm')}</div>
        ))}
      </div>
    </div>
  )
}
