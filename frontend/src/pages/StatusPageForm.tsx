import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useStatusPage, useCreateStatusPage, useUpdateStatusPage } from '../hooks/useStatusPages'
import { useMonitors } from '../hooks/useMonitors'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function StatusPageForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id
  useDocumentTitle(`${isEditing ? 'Edit' : 'New'} status page · DronWatch`)

  const { data: existing } = useStatusPage(id || '')
  const { data: monitors } = useMonitors()
  const create = useCreateStatusPage()
  const update = useUpdateStatusPage(id || '')

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    monitor_ids: [] as string[],
    is_public: true,
    background_color: '#0f172a',
    branding_default: true,
    subscriptions_enabled: true
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        slug: existing.slug,
        description: existing.description || '',
        monitor_ids: existing.monitor_ids,
        is_public: existing.is_public,
        background_color: existing.background_color,
        branding_default: existing.branding_default,
        subscriptions_enabled: existing.subscriptions_enabled
      })
    }
  }, [existing])

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(f => ({ ...f, name, ...(isEditing ? {} : { slug }) }))
  }

  const toggleMonitor = (monitorId: string) => {
    setForm(f => ({
      ...f,
      monitor_ids: f.monitor_ids.includes(monitorId)
        ? f.monitor_ids.filter(id => id !== monitorId)
        : [...f.monitor_ids, monitorId]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing) {
      update.mutate(form, { onSuccess: () => navigate('/dashboard/status-pages') })
    } else {
      create.mutate(form, { onSuccess: () => navigate('/dashboard/status-pages') })
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/dashboard/status-pages" className="text-surface-500 hover:text-surface-300 transition-colors text-sm">
          Status pages
        </Link>
        <span className="text-surface-700">/</span>
        <span className="text-sm text-surface-300">{isEditing ? 'Edit page' : 'New page'}</span>
      </div>

      <h1 className="text-xl font-bold text-surface-50 mb-6">
        {isEditing ? 'Edit status page' : 'Create a status page'}
      </h1>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label">Page name</label>
          <input
            type="text"
            className="input"
            placeholder="My Service Status"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">URL slug</label>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 py-2 rounded-l-lg border border-r-0 border-surface-700 bg-surface-900 text-sm text-surface-500 whitespace-nowrap">
              /status/
            </span>
            <input
              type="text"
              className="input rounded-l-none"
              placeholder="my-service"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              pattern="^[a-z0-9-]+$"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Current status for all services."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div>
          <label className="label mb-3">Monitors to include</label>
          {monitors?.length === 0 ? (
            <p className="text-sm text-surface-500">No monitors yet. <Link to="/dashboard/monitors/new" className="text-brand-400">Create one first.</Link></p>
          ) : (
            <div className="space-y-2">
              {monitors?.map(monitor => (
                <label key={monitor.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.monitor_ids.includes(monitor.id)}
                    onChange={() => toggleMonitor(monitor.id)}
                    className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-surface-950"
                  />
                  <span className="text-sm text-surface-200">{monitor.name}</span>
                  <span className="text-xs font-mono text-surface-500 truncate">{monitor.url}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label mb-2">Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_public: true }))}
              className={form.is_public
                ? 'btn-primary justify-center'
                : 'btn-ghost justify-center'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              Public
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_public: false }))}
              className={!form.is_public
                ? 'btn-primary justify-center'
                : 'btn-ghost justify-center'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Private
            </button>
          </div>
          <p className="text-xs text-surface-600 mt-1.5">
            {form.is_public
              ? 'Anyone with the link can view this page.'
              : 'Only you can view this page.'}
          </p>
        </div>

        <div>
          <label className="label">Background color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.background_color}
              onChange={e => setForm(f => ({ ...f, background_color: e.target.value }))}
              className="h-9 w-16 rounded cursor-pointer border border-surface-700 bg-surface-800"
            />
            <input
              type="text"
              className="input w-32 font-mono"
              value={form.background_color}
              onChange={e => setForm(f => ({ ...f, background_color: e.target.value }))}
              pattern="^#[0-9a-fA-F]{6}$"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="label mb-0">Options</label>
          {[
            { key: 'branding_default', label: 'Show "Powered by DronWatch"', desc: 'Disable to hide the attribution link.' },
            { key: 'subscriptions_enabled', label: 'Email subscriptions', desc: 'Allow visitors to subscribe to status changes.' }
          ].map(opt => (
            <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!(form as any)[opt.key]}
                onChange={() => setForm(f => ({ ...f, [opt.key]: !(f as any)[opt.key] }))}
                className="mt-0.5 w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-surface-950"
              />
              <span>
                <span className="block text-sm text-surface-200">{opt.label}</span>
                <span className="block text-xs text-surface-600">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Saving...' : isEditing ? 'Save changes' : 'Create page'}
          </button>
          <Link to="/dashboard/status-pages" className="btn-ghost ml-auto">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
