import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMonitor, useCreateMonitor, useUpdateMonitor, useTestMonitor, useMonitors } from '../hooks/useMonitors'
import NotificationChannelPicker from '../components/NotificationChannelPicker'
import { NotificationChannel, MonitorType } from '../types'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import { useEscalationPolicies } from '../hooks/useEscalationPolicies'

const INTERVALS = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '3 minutes', value: 180 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: '60 minutes', value: 3600 }
]

const TYPES: { value: MonitorType; label: string; desc: string }[] = [
  { value: 'http', label: 'HTTP / HTTPS', desc: 'REST, GraphQL, multi-step' },
  { value: 'keyword', label: 'Keyword', desc: 'Contain / regex / content' },
  { value: 'ping', label: 'Ping', desc: 'ICMP reachability' },
  { value: 'tcp', label: 'TCP Port', desc: 'Host + port, TLS, text probe' },
  { value: 'dns', label: 'DNS', desc: 'A..SRV, custom resolver' },
  { value: 'heartbeat', label: 'Heartbeat', desc: 'Cron / job signals' },
  { value: 'ssl', label: 'SSL / TLS', desc: 'Certificate + expiry' },
  { value: 'domain', label: 'Domain', desc: 'RDAP/WHOIS expiry' }
]

type Section = 'auth' | 'headers' | 'cookies' | 'checks' | 'advanced' | 'multi'

export default function MonitorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id
  const { data: existing } = useMonitor(id || '')
  const { data: allMonitors } = useMonitors()
  const create = useCreateMonitor()
  const update = useUpdateMonitor(id || '')
  const test = useTestMonitor()

  const [form, setForm] = useState({
    url: '',
    name: '',
    type: 'http' as MonitorType,
    config: {} as Record<string, any>,
    expected_status: null as number | null,
    check_interval: 300,
    retry_count: 1,
    parent_monitor_id: null as string | null,
    escalation_policy_id: null as string | null,
    notification_channels: [] as NotificationChannel[]
  })
  const [open, setOpen] = useState<Section | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        url: existing.url,
        name: existing.name,
        type: existing.type || 'http',
        config: existing.config || {},
        expected_status: existing.expected_status ?? null,
        check_interval: existing.check_interval,
        retry_count: existing.retry_count || 1,
        parent_monitor_id: existing.parent_monitor_id || null,
        escalation_policy_id: (existing as any).escalation_policy_id || null,
        notification_channels: existing.notification_channels
      })
    }
  }, [existing])

  const setCfg = (patch: Record<string, any>) => setForm(f => ({ ...f, config: { ...f.config, ...patch } }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      ...form,
      config: {
        ...form.config,
        headers: form.config.headers && Object.keys(form.config.headers).length ? form.config.headers : undefined,
        cookies: form.config.cookies && form.config.cookies.length ? form.config.cookies.filter((c: any) => c.name && c.value) : undefined,
        auth: form.config.auth?.type ? form.config.auth : undefined,
        accepted_codes: (form.config.accepted_codes || []).length ? form.config.accepted_codes : undefined,
        steps: form.type === 'http' && form.config.steps?.length ? form.config.steps : undefined
      }
    }
    if (form.type === 'heartbeat') payload.url = `heartbeat://${form.name.toLowerCase().replace(/\s+/g, '-')}`
    for (const k of Object.keys(payload.config)) {
      if (payload.config[k] === undefined) delete payload.config[k]
    }
    if (isEditing) update.mutate(payload, { onSuccess: () => navigate(`/dashboard/monitors/${id}`) })
    else create.mutate(payload, { onSuccess: (data) => navigate(`/dashboard/monitors/${data.id}`) })
  }

  const isPending = create.isPending || update.isPending
  const cfg = form.config
  const toggle = (s: Section) => setOpen(open === s ? null : s)

  const { data: availableRegions } = useQuery({
    queryKey: ['available-regions'],
    queryFn: async () => {
      const { data } = await api.get('/api/monitors/available-regions')
      return data as Array<{ code: string; label: string }>
    },
    staleTime: 5 * 60 * 1000
  })
  const { data: escalationPolicies } = useEscalationPolicies()

  const HeadersEditor = (
    <div className="space-y-2">
      {(Object.entries(cfg.headers || {}) as [string, any][]).map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <input className="input font-mono flex-1" placeholder="Header name" value={k} onChange={e => {
            const h = { ...(cfg.headers || {}) }; delete h[k]; if (e.target.value) h[e.target.value] = v; setCfg({ headers: h })
          }} />
          <input className="input font-mono flex-1" placeholder="Value (supports {{var}})" value={v} onChange={e => setCfg({ headers: { ...(cfg.headers || {}), [k]: e.target.value } })} />
          <button type="button" className="btn-ghost" onClick={() => { const h = { ...(cfg.headers || {}) }; delete h[k]; setCfg({ headers: h }) }}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn-ghost text-xs" onClick={() => setCfg({ headers: { ...(cfg.headers || {}), 'X-Custom': '' } })}>+ Add header</button>
    </div>
  )

  const CookiesEditor = (
    <div className="space-y-2">
      {(cfg.cookies || []).map((c: any, i: number) => (
        <div key={i} className="flex gap-2">
          <input className="input font-mono flex-1" placeholder="Name" value={c.name || ''} onChange={e => { const arr = [...(cfg.cookies || [])]; arr[i].name = e.target.value; setCfg({ cookies: arr }) }} />
          <input className="input font-mono flex-1" placeholder="Value" value={c.value || ''} onChange={e => { const arr = [...(cfg.cookies || [])]; arr[i].value = e.target.value; setCfg({ cookies: arr }) }} />
          <button type="button" className="btn-ghost" onClick={() => setCfg({ cookies: (cfg.cookies || []).filter((_: any, x: number) => x !== i) })}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn-ghost text-xs" onClick={() => setCfg({ cookies: [...(cfg.cookies || []), { name: '', value: '' }] })}>+ Add cookie</button>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/dashboard" className="text-surface-500 hover:text-surface-300 transition-colors text-sm">Monitors</Link>
        <span className="text-surface-700">/</span>
        <span className="text-sm text-surface-300">{isEditing ? 'Edit monitor' : 'New monitor'}</span>
      </div>
      <h1 className="text-xl font-bold text-surface-50 mb-6">{isEditing ? 'Edit monitor' : 'Create a monitor'}</h1>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label">Monitor type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${form.type === t.value ? 'border-brand-500 bg-brand-500/10' : 'border-surface-800 bg-surface-900 hover:border-surface-700'}`}>
                <p className={`text-xs font-semibold ${form.type === t.value ? 'text-brand-400' : 'text-surface-200'}`}>{t.label}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{form.type === 'heartbeat' ? 'Heartbeat name (URL auto-generated)' : form.type === 'tcp' ? 'Label / URL' : 'URL'}</label>
          <input type="text" className="input font-mono" placeholder={form.type === 'tcp' ? 'db.example.com:5432 or https://example.com' : 'https://example.com'} value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required={form.type !== 'heartbeat'} />
          {form.type === 'heartbeat' && form.name && <p className="text-xs font-mono text-surface-500 mt-1">Ping URL: POST /api/monitors/heartbeat/{id || '{id}'}?token=SECRET</p>}
        </div>

        <div>
          <label className="label">Display name</label>
          <input type="text" className="input" placeholder="My API" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>

        {(form.type === 'http' || form.type === 'keyword') && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Method</label>
              <select className="input" value={cfg.method || 'GET'} onChange={e => setCfg({ method: e.target.value })}>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Expected status</label>
              <input type="number" className="input" placeholder="200" value={form.expected_status ?? ''} onChange={e => setForm(f => ({ ...f, expected_status: e.target.value ? parseInt(e.target.value) : null }))} />
            </div>
            <div>
              <label className="label">Timeout ms</label>
              <input type="number" className="input" value={cfg.timeout || 15000} onChange={e => setCfg({ timeout: parseInt(e.target.value) })} />
            </div>
          </div>
        )}

        {form.type === 'keyword' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Keyword / content</label>
              <input type="text" className="input" placeholder="Welcome" value={cfg.keyword || ''} onChange={e => setCfg({ keyword: e.target.value })} />
            </div>
            <div>
              <label className="label">Match</label>
              <select className="input" value={cfg.keyword_match || 'contain'} onChange={e => setCfg({ keyword_match: e.target.value })}>
                <option value="contain">Must contain</option><option value="not_contain">Must NOT contain</option>
              </select>
            </div>
            <div>
              <label className="label">Regex (optional)</label>
              <input type="text" className="input font-mono" placeholder="^OK$" value={cfg.regex || ''} onChange={e => setCfg({ regex: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-surface-300 pt-6">
              <input type="checkbox" className="accent-brand-500" checked={!!cfg.keyword_exact} onChange={e => setCfg({ keyword_exact: e.target.checked })} /> Exact match
            </label>
            <div>
              <label className="label">Case sensitive</label>
              <select className="input" value={cfg.keyword_case_sensitive ? 'y' : ''} onChange={e => setCfg({ keyword_case_sensitive: e.target.value === 'y' })}>
                <option value="">No</option><option value="y">Yes</option>
              </select>
            </div>
            <div>
              <label className="label">Change detection (content hash)</label>
              <select className="input" value={cfg.change_detection ? 'y' : ''} onChange={e => setCfg({ change_detection: e.target.value === 'y' })}>
                <option value="">Off</option><option value="y">Alert on content change</option>
              </select>
            </div>
          </div>
        )}

        {form.type === 'tcp' && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Host</label><input className="input font-mono" placeholder="db.example.com" value={cfg.host || ''} onChange={e => setCfg({ host: e.target.value })} /></div>
              <div><label className="label">Port</label><input type="number" className="input" value={cfg.port || ''} onChange={e => setCfg({ port: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
              <div><label className="label">TLS over TCP</label><select className="input" value={cfg.tls ? 'y' : ''} onChange={e => setCfg({ tls: e.target.value === 'y' })}><option value="">No</option><option value="y">Yes</option></select></div>
              <div><label className="label">Expected text after connect</label><input className="input font-mono" placeholder="220 SMTP ready" value={cfg.expect_text || ''} onChange={e => setCfg({ expect_text: e.target.value })} /></div>
            </div>
          </>
        )}

        {form.type === 'dns' && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label">Hostname</label><input className="input font-mono" placeholder="example.com" value={cfg.hostname || ''} onChange={e => setCfg({ hostname: e.target.value })} /></div>
            <div><label className="label">Record type</label><select className="input" value={cfg.record_type || 'A'} onChange={e => setCfg({ record_type: e.target.value })}>{['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'ANY'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="label">Resolver (optional)</label><input className="input font-mono" placeholder="8.8.8.8" value={cfg.resolver || ''} onChange={e => setCfg({ resolver: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <label className="label">Expected values (comma separated)</label>
              <input className="input font-mono" placeholder="1.2.3.4, 2001:db8::1" value={(cfg.expected_values || []).join(', ')} onChange={e => setCfg({ expected_values: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>
            <div>
              <label className="label">Or single expected</label>
              <input className="input font-mono" value={cfg.expected_value || ''} onChange={e => setCfg({ expected_value: e.target.value })} />
            </div>
          </div>
        )}

        {form.type === 'heartbeat' && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label">Grace period (s)</label><input type="number" className="input" value={cfg.grace_seconds || 300} onChange={e => setCfg({ grace_seconds: parseInt(e.target.value) })} /></div>
            <div><label className="label">Secret token</label><input className="input font-mono" placeholder="optional, checked on ping" value={cfg.token || ''} onChange={e => setCfg({ token: e.target.value })} /></div>
            <div><label className="label">Min duration (ms)</label><input type="number" className="input" value={cfg.min_duration || ''} onChange={e => setCfg({ min_duration: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
            <div><label className="label">Max duration (ms)</label><input type="number" className="input" value={cfg.max_duration || ''} onChange={e => setCfg({ max_duration: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
            <div><label className="label">Schedule window start (hour)</label><input type="number" className="input" min="0" max="23" value={cfg.schedule_start ?? ''} onChange={e => setCfg({ schedule_start: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
            <div><label className="label">Schedule window end (hour)</label><input type="number" className="input" min="1" max="24" value={cfg.schedule_end ?? ''} onChange={e => setCfg({ schedule_end: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
          </div>
        )}

        {form.type === 'ping' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Samples</label><input type="number" className="input" value={cfg.samples || 3} onChange={e => setCfg({ samples: parseInt(e.target.value) })} /></div>
            <div><label className="label">High latency alert (ms)</label><input type="number" className="input" value={cfg.high_latency_ms || ''} onChange={e => setCfg({ high_latency_ms: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
          </div>
        )}

        {form.type === 'ssl' && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label">Days before expiry to alert</label><input type="number" className="input" value={cfg.days_threshold || 14} onChange={e => setCfg({ days_threshold: parseInt(e.target.value) })} /></div>
            <div><label className="label">Warn day count</label><input type="number" className="input" value={cfg.warn_days || 60} onChange={e => setCfg({ warn_days: parseInt(e.target.value) })} /></div>
            <div><label className="label">Allow self-signed</label><select className="input" value={cfg.allow_self_signed ? 'y' : ''} onChange={e => setCfg({ allow_self_signed: e.target.value === 'y' })}><option value="">No</option><option value="y">Yes</option></select></div>
          </div>
        )}

        {form.type === 'domain' && (
          <div>
            <label className="label">Expected nameservers (comma separated)</label>
            <input className="input font-mono" placeholder="ns1.example.com, ns2.example.com" value={(cfg.expected_nameservers || []).join(', ')} onChange={e => setCfg({ expected_nameservers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          </div>
        )}

        {(form.type === 'http' || form.type === 'keyword') && (
          <div className="border-t border-surface-800 pt-4 space-y-3">
            <SectionToggle label="Authentication" open={open === 'auth'} onToggle={() => toggle('auth')}>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><label className="label">Type</label><select className="input" value={cfg.auth?.type || ''} onChange={e => setCfg({ auth: { ...(cfg.auth || {}), type: e.target.value } })}><option value="">None</option><option value="basic">Basic</option><option value="bearer">Bearer token</option><option value="api_key">API key</option></select></div>
                {cfg.auth?.type === 'basic' && (<><div><label className="label">Username</label><input className="input" value={cfg.auth.username || ''} onChange={e => setCfg({ auth: { ...cfg.auth, username: e.target.value } })} /></div><div><label className="label">Password</label><input type="password" className="input" value={cfg.auth.password || ''} onChange={e => setCfg({ auth: { ...cfg.auth, password: e.target.value } })} /></div></>)}
                {cfg.auth?.type === 'bearer' && <div className="sm:col-span-2"><label className="label">Token (supports {'{{var}}'})</label><input className="input font-mono" value={cfg.auth.token || ''} onChange={e => setCfg({ auth: { ...cfg.auth, token: e.target.value } })} /></div>}
                {cfg.auth?.type === 'api_key' && (<>
                  <div><label className="label">Key name</label><input className="input" value={cfg.auth.key_name || ''} onChange={e => setCfg({ auth: { ...cfg.auth, key_name: e.target.value } })} /></div>
                  <div><label className="label">Key value</label><input className="input font-mono" value={cfg.auth.value || ''} onChange={e => setCfg({ auth: { ...cfg.auth, value: e.target.value } })} /></div>
                  <div><label className="label">Location</label><select className="input" value={cfg.auth.location || 'header'} onChange={e => setCfg({ auth: { ...cfg.auth, location: e.target.value } })}><option value="header">Header</option><option value="query">Query param</option></select></div>
                </>)}
              </div>
            </SectionToggle>
            <SectionToggle label="Headers" open={open === 'headers'} onToggle={() => toggle('headers')}>{HeadersEditor}</SectionToggle>
            <SectionToggle label="Cookies" open={open === 'cookies'} onToggle={() => toggle('cookies')}>{CookiesEditor}</SectionToggle>
            <SectionToggle label="Body, Content-Type, GraphQL" open={open === 'advanced'} onToggle={() => toggle('advanced')}>
              <div className="space-y-4">
                <div>
                  <label className="label">Request body (JSON/text/form)</label>
                  <textarea className="input font-mono h-24" placeholder='{"email":"{{user_email}}"}' value={cfg.body || ''} onChange={e => setCfg({ body: e.target.value })} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="label">Content-Type</label><input className="input font-mono" placeholder="application/json" value={cfg.content_type || ''} onChange={e => setCfg({ content_type: e.target.value })} /></div>
                  <div><label className="label">Expected Content-Type</label><input className="input font-mono" placeholder="application/json" value={cfg.expect_content_type || ''} onChange={e => setCfg({ expect_content_type: e.target.value })} /></div>
                  <div><label className="label">Max response size (bytes)</label><input type="number" className="input" value={cfg.max_response_size || ''} onChange={e => setCfg({ max_response_size: e.target.value ? parseInt(e.target.value) : undefined })} /></div>
                  <div><label className="label">Max redirects</label><input type="number" className="input" value={cfg.max_redirects || 3} onChange={e => setCfg({ max_redirects: parseInt(e.target.value) })} /></div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-surface-300"><input type="checkbox" className="accent-brand-500" checked={!!cfg.is_graphql} onChange={e => setCfg({ is_graphql: e.target.checked })} /> GraphQL query</label>
                  <label className="flex items-center gap-2 text-sm text-surface-300"><input type="checkbox" className="accent-brand-500" checked={cfg.follow_redirects !== false} onChange={e => setCfg({ follow_redirects: e.target.checked })} /> Follow redirects</label>
                  <label className="flex items-center gap-2 text-sm text-surface-300"><input type="checkbox" className="accent-brand-500" checked={!!cfg.check_compression} onChange={e => setCfg({ check_compression: e.target.checked })} /> Require compression</label>
                  <label className="flex items-center gap-2 text-sm text-surface-300"><input type="checkbox" className="accent-brand-500" checked={!!cfg.check_security_headers} onChange={e => setCfg({ check_security_headers: e.target.checked })} /> Check security headers</label>
                  <label className="flex items-center gap-2 text-sm text-surface-300"><input type="checkbox" className="accent-brand-500" checked={!!cfg.allow_invalid_certs} onChange={e => setCfg({ allow_invalid_certs: e.target.checked })} /> Allow invalid TLS cert</label>
                </div>
                {cfg.is_graphql && <div><label className="label">GraphQL query</label><textarea className="input font-mono h-24" value={cfg.graphql_query || ''} onChange={e => setCfg({ graphql_query: e.target.value })} /></div>}
              </div>
            </SectionToggle>
            <SectionToggle label="Content validation (JQ / JSONPath / JSON compare)" open={open === 'checks'} onToggle={() => toggle('checks')}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">JSONPath</label><input className="input font-mono" placeholder="data.items[0].status" value={cfg.jsonpath || ''} onChange={e => setCfg({ jsonpath: e.target.value })} /></div>
                <div><label className="label">JSONPath expected value</label><input className="input font-mono" value={cfg.jsonpath_expected || ''} onChange={e => setCfg({ jsonpath_expected: e.target.value })} /></div>
                <div><label className="label">JSON subset to match</label><textarea className="input font-mono h-20" placeholder='{"status":"ok"}' value={cfg.json_compare ? JSON.stringify(cfg.json_compare, null, 2) : ''} onChange={e => { try { setCfg({ json_compare: JSON.parse(e.target.value) }) } catch {} }} /></div>
                <div><label className="label">Ignore dynamic areas (regex)</label><input className="input font-mono" placeholder="<script[^>]*>.*?<\\/script>" value={(cfg.ignore_patterns || []).join(', ')} onChange={e => setCfg({ ignore_patterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
              </div>
            </SectionToggle>
            <SectionToggle label="Multi-step API flow (browser-less)" open={open === 'multi'} onToggle={() => toggle('multi')}>
              <div className="space-y-3">
                {((cfg.steps || []) as any[]).map((s, i) => (
                  <div key={i} className="rounded-lg border border-surface-800 p-3 space-y-2">
                    <div className="flex items-center gap-2"><span className="text-xs font-bold text-brand-400">Step {i + 1}</span><input className="input flex-1" placeholder="Step name" value={s.name || ''} onChange={e => { const arr = [...(cfg.steps || [])]; arr[i] = { ...arr[i], name: e.target.value }; setCfg({ steps: arr }) }} /><button type="button" className="btn-ghost text-xs" onClick={() => setCfg({ steps: (cfg.steps || []).filter((_: any, x: number) => x !== i) })}>Remove</button></div>
                    <div className="grid grid-cols-3 gap-2">
                      <select className="input" value={s.method || 'GET'} onChange={e => { const arr = [...(cfg.steps || [])]; arr[i] = { ...arr[i], method: e.target.value }; setCfg({ steps: arr }) }}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}</select>
                      <input className="input font-mono col-span-2" placeholder="https://api.example.com/step" value={s.url || ''} onChange={e => { const arr = [...(cfg.steps || [])]; arr[i] = { ...arr[i], url: e.target.value }; setCfg({ steps: arr }) }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input" placeholder="Expected status" value={s.expected_status || ''} onChange={e => { const arr = [...(cfg.steps || [])]; arr[i] = { ...arr[i], expected_status: e.target.value ? parseInt(e.target.value) : undefined }; setCfg({ steps: arr }) }} />
                      <input className="input" placeholder="Expect content" value={s.expect_content || ''} onChange={e => { const arr = [...(cfg.steps || [])]; arr[i] = { ...arr[i], expect_content: e.target.value }; setCfg({ steps: arr }) }} />
                      <input className="input font-mono" placeholder="Extract {{var}}=path" value={(s.extract || []).map((e: any) => `${e.var}=${e.path}`).join(', ')} onChange={e => { const arr = [...(cfg.steps || [])]; arr[i] = { ...arr[i], extract: e.target.value.split(',').map(t => t.trim()).filter(Boolean).map(t => { const [v, p] = t.split('='); return { var: v, path: p } }) }; setCfg({ steps: arr }) }} />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-ghost text-xs" onClick={() => setCfg({ steps: [...(cfg.steps || []), { name: '', method: 'GET', url: '', extract: [] }] })}>+ Add step</button>
              </div>
            </SectionToggle>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Check interval</label>
            <select className="input" value={form.check_interval} onChange={e => setForm(f => ({ ...f, check_interval: parseInt(e.target.value) }))}>
              {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Retries before alert</label>
            <select className="input" value={form.retry_count} onChange={e => setForm(f => ({ ...f, retry_count: parseInt(e.target.value) }))}>
              <option value={1}>1 (no retry)</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={cfg.priority || form.config.priority || 0} onChange={e => setForm(f => ({ ...f, config: { ...f.config, priority: parseInt(e.target.value) } }))}>
              <option value={3}>Critical</option><option value={2}>High</option><option value={1}>Medium</option><option value={0}>Normal</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Parent dependency</label>
          <select className="input" value={form.parent_monitor_id || ''} onChange={e => setForm(f => ({ ...f, parent_monitor_id: e.target.value || null }))}>
            <option value="">None</option>
            {(allMonitors || []).filter(m => m.id !== id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Multi-region probes</label>
          <p className="text-xs text-surface-500 mb-2">Select where to probe from. Single host replicates the result per region for history; with workers deployed per <code className="font-mono">REGION</code> it becomes truly geo-distributed.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(availableRegions || []).map(r => {
              const checked = (cfg.regions || []).includes(r.code)
              return (
                <label key={r.code} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${checked ? 'border-brand-500 bg-brand-500/10 text-brand-300' : 'border-surface-800 bg-surface-900 text-surface-300 hover:border-surface-700'}`}>
                  <input type="checkbox" checked={checked} onChange={e => {
                    const cur = new Set<string>(cfg.regions || [])
                    if (e.target.checked) cur.add(r.code); else cur.delete(r.code)
                    setCfg({ regions: Array.from(cur) })
                  }} className="accent-brand-500" />
                  <span className="font-mono text-xs">{r.code}</span>
                  <span className="truncate text-xs">{r.label}</span>
                </label>
              )
            })}
          </div>
          {(cfg.regions || []).length > 1 && (
            <div className="mt-3 max-w-xs">
              <label className="label">Quorum mode</label>
              <select className="input" value={cfg.region_mode || 'quorum'} onChange={e => setCfg({ region_mode: e.target.value })}>
                <option value="quorum">Quorum — majority up → overall UP</option>
                <option value="all">All — every region must be up</option>
                <option value="any">Any — at least one region up → overall UP</option>
              </select>
              <p className="text-xs text-surface-600 mt-1">Determines when a partial outage counts as DOWN and triggers alerts/incidents.</p>
            </div>
          )}
        </div>

        <div>
          <label className="label">Escalation policy</label>
          <select className="input" value={form.escalation_policy_id || ''} onChange={e => setForm(f => ({ ...f, escalation_policy_id: e.target.value || null }))}>
            <option value="">No escalation — use immediate channels only</option>
            {(escalationPolicies || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.steps.length} steps)</option>)}
          </select>
          <p className="text-xs text-surface-600 mt-1">If set, DOWN will fire step 0 immediately and later steps after their delays while still down.</p>
        </div>

        <div>
          <label className="label mb-2">Alert channels</label>
          <NotificationChannelPicker value={form.notification_channels} onChange={channels => setForm(f => ({ ...f, notification_channels: channels }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isPending} className="btn-primary">{isPending ? 'Saving...' : isEditing ? 'Save changes' : 'Create monitor'}</button>
          {isEditing && <button type="button" onClick={() => test.mutate(id!)} disabled={test.isPending} className="btn-ghost">{test.isPending ? 'Checking...' : 'Test now'}</button>}
          <Link to={isEditing ? `/dashboard/monitors/${id}` : '/dashboard'} className="btn-ghost ml-auto">Cancel</Link>
        </div>
      </form>
    </div>
  )
}

function SectionToggle({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-surface-800 rounded-lg">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 text-sm text-surface-300 hover:bg-surface-900 rounded-lg">
        <span>{label}</span>
        <span className="text-surface-500">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  )
}