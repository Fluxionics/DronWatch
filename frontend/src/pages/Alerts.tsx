import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useAlerts } from '../hooks/useAlerts'
import { useMonitors } from '../hooks/useMonitors'
import { useAlertRules, useCreateAlertRule, useUpdateAlertRule, useDeleteAlertRule } from '../hooks/useAlertRules'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { NotificationChannel } from '../types'
import api from '../utils/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useEscalationPolicies, useCreateEscalationPolicy, useDeleteEscalationPolicy } from '../hooks/useEscalationPolicies'

const typeColors: Record<string, string> = {
  email: 'text-brand-400 border-brand-500/40 bg-brand-500/10',
  slack: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  discord: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
  webhook: 'text-amber-400 border-amber-500/40 bg-amber-500/10'
}

const conditions = [
  { value: 'down_for', label: 'Down for' },
  { value: 'latency_above', label: 'Latency above (ms)' },
  { value: 'ssl_expires_within', label: 'SSL expires within (days)' },
  { value: 'status_code', label: 'Status code !=' },
  { value: 'keyword', label: 'Keyword/content failed' },
  { value: 'response_size_above', label: 'Response size above (bytes)' },
  { value: 'error_rate_above', label: 'Error rate above (%)' }
]

export default function Alerts() {
  useDocumentTitle('Alerts · DronWatch')
  const { data, isLoading } = useAlerts()

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-surface-50">Alerts</h1>
        <p className="text-sm text-surface-500 mt-0.5">Every notification sent when a service went down or recovered</p>
      </div>

      <TestChannelSection />

      <EscalationPoliciesSection />

      <AlertRulesSection />

      <div>
        <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wide mb-3">History</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-14 bg-surface-800" />)}
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <div className="card text-center py-12">
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
    </div>
  )
}

const channelTypes = ['email', 'slack', 'discord', 'webhook', 'telegram', 'teams', 'google_chat', 'pushover', 'gotify', 'mattermost', 'matrix', 'pagerduty', 'opsgenie', 'twilio_sms', 'jira', 'linear', 'github_issue', 'gitlab_issue', 'webpush']

function TestChannelSection() {
  const { data: monitors } = useMonitors()
  const [monitorId, setMonitorId] = useState('')
  const [type, setType] = useState('email')
  const [recipient, setRecipient] = useState('')
  const [sending, setSending] = useState(false)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/api/alerts/test', { monitor_id: monitorId, type, recipient })
      toast.success('Test notification sent — check the channel')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Test notification failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wide mb-1">Test a channel</h2>
      <p className="text-xs text-surface-500 mb-3">Send a real test notification through any channel to verify it works. It appears in history marked [TEST].</p>
      <form onSubmit={send} className="grid sm:grid-cols-4 gap-3">
        <select className="input" value={monitorId} onChange={e => setMonitorId(e.target.value)} required>
          <option value="">Monitor…</option>
          {(monitors || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="input" value={type} onChange={e => setType(e.target.value)}>
          {channelTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input font-mono text-xs" placeholder="recipient (email, webhook URL…)" value={recipient} onChange={e => setRecipient(e.target.value)} required />
        <button type="submit" disabled={sending || !monitorId || !recipient} className="btn bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-40">
          {sending ? 'Sending…' : 'Send test'}
        </button>
      </form>
    </div>
  )
}

function AlertRulesSection() {
  const { data: rules, isLoading } = useAlertRules()
  const { data: monitorsData } = useMonitors()
  const monitors = monitorsData || []
  const create = useCreateAlertRule()
  const [form, setForm] = useState({
    name: '',
    monitor_id: '',
    condition: 'down_for',
    threshold: '',
    for_minutes: '0',
    channels: '',
    enabled: 'true'
  })

  const canSubmit = form.name.trim() && form.monitor_id && (form.condition === 'ssl_expires_within' || Number(form.threshold))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const channels: NotificationChannel[] = form.channels
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        const idx = line.indexOf(':')
        if (idx === -1) return { type: 'email' as const, target: line }
        return { type: line.slice(0, idx).trim() as NotificationChannel['type'], target: line.slice(idx + 1).trim() }
      })
      .filter(ch => (ch.target || '').length > 0)
    if (channels.length === 0) return
    create.mutate({
      name: form.name,
      monitor_id: form.monitor_id,
      condition: form.condition as any,
      threshold: Number(form.threshold),
      for_minutes: Number(form.for_minutes),
      channels,
      enabled: form.enabled === 'true'
    })
    setForm({ name: '', monitor_id: '', condition: 'down_for', threshold: '', for_minutes: '0', channels: '', enabled: 'true' })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wide mb-3">Alert rules</h2>
        <div className="card p-5">
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Rule name</label>
                <input
                  className="input"
                  placeholder="e.g. Prod latency"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Monitor</label>
                <select
                  className="input"
                  value={form.monitor_id}
                  onChange={e => setForm({ ...form, monitor_id: e.target.value })}
                >
                  <option value="">Select a monitor</option>
                  {monitors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Condition</label>
                <select
                  className="input"
                  value={form.condition}
                  onChange={e => setForm({ ...form, condition: e.target.value })}
                >
                  {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">
                  {form.condition === 'ssl_expires_within' ? 'Days'
                    : form.condition === 'latency_above' ? 'Threshold (ms)' : 'Threshold'}
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder={form.condition === 'ssl_expires_within' ? '30' : form.condition === 'latency_above' ? '1000' : '2'}
                  value={form.threshold}
                  onChange={e => setForm({ ...form, threshold: e.target.value })}
                />
              </div>
              {form.condition !== 'ssl_expires_within' && (
                <div>
                  <label className="label">For (minutes)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.for_minutes}
                    onChange={e => setForm({ ...form, for_minutes: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="label">Channels (one per line: type:target, e.g. email:a@b.com or webhook:https://…)</label>
              <textarea
                className="input font-mono text-xs"
                rows={2}
                placeholder={'email:you@company.com\nslack:https://hooks.slack.com/services/…'}
                value={form.channels}
                onChange={e => setForm({ ...form, channels: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-3 text-sm text-surface-300">
                <input
                  type="checkbox"
                  checked={form.enabled === 'true'}
                  onChange={e => setForm({ ...form, enabled: e.target.checked ? 'true' : 'false' })}
                  className="w-4 h-4 accent-brand-500"
                />
                Enabled
              </label>
              <button type="submit" disabled={!canSubmit || create.isPending} className="btn bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-40">
                {create.isPending ? 'Saving…' : 'Add rule'}
              </button>
              <span className="text-xs text-surface-600">Tip: rules are evaluated on every check and alert once until the condition clears.</span>
            </div>
          </form>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="card animate-pulse h-12 bg-surface-800" />)}
        </div>
      ) : !rules || rules.length === 0 ? (
        <p className="text-sm text-surface-600">No rules yet. Create one above to get alerts for specific conditions.</p>
      ) : (
        <div className="card overflow-hidden p-0">
          <ul className="divide-y divide-surface-800">
            {rules.map(rule => <RuleRow key={rule.id} rule={rule} />)}
          </ul>
        </div>
      )}
    </div>
  )
}

function RuleRow({ rule }: { rule: any }) {
  const update = useUpdateAlertRule(rule.id)
  const remove = useDeleteAlertRule()
  const condText = rule.condition === 'down_for'
    ? `Down for ${rule.threshold} min`
    : rule.condition === 'latency_above'
      ? `Latency above ${rule.threshold}ms`
      : rule.condition === 'status_code'
        ? `Status != ${rule.threshold}`
        : rule.condition === 'keyword'
          ? `Content check failed`
          : rule.condition === 'response_size_above'
            ? `Size > ${rule.threshold} bytes`
            : rule.condition === 'error_rate_above'
              ? `Error rate > ${rule.threshold}%`
              : `SSL renews within ${rule.threshold} days`

  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <span className={clsx('w-2 h-2 rounded-full shrink-0', rule.enabled ? 'bg-emerald-400' : 'bg-surface-600')} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-surface-100">{rule.name}</span>
          <span className="text-xs text-surface-500 font-mono">{rule.condition}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-surface-700 bg-surface-800 text-surface-300">
            {rule.monitors?.name || 'Monitor'}
          </span>
        </div>
        <p className="text-xs text-surface-600 mt-0.5">
          {condText} · {rule.channels?.map((c: any) => `${c.type} → ${c.target}`).join(', ') || 'no channels'}
          {rule.last_fired_at && <> · fired {formatDistanceToNow(new Date(rule.last_fired_at), { addSuffix: true })}</>}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs text-surface-400 shrink-0">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={e => update.mutate({ enabled: e.target.checked })}
          className="w-4 h-4 accent-brand-500"
        />
        On
      </label>
      <button
        onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) remove.mutate(rule.id) }}
        className="btn-ghost text-xs shrink-0"
      >
        Delete
      </button>
    </li>
  )
}

function EscalationPoliciesSection() {
  const { data: policies, isLoading } = useEscalationPolicies()
  const create = useCreateEscalationPolicy()
  const remove = useDeleteEscalationPolicy()
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<Array<{ delay_minutes: string; channels: string }>>([{ delay_minutes: '0', channels: '' }])

  const canSubmit = name.trim() && steps.every(s => s.channels.trim())

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = steps.map(s => ({
      delay_minutes: Number(s.delay_minutes) || 0,
      channels: s.channels.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const idx = l.indexOf(':')
        return idx === -1 ? { type: 'email', target: l } : { type: l.slice(0, idx).trim(), target: l.slice(idx + 1).trim() }
      }).filter(c => c.target) as any
    })).filter(s => s.channels.length > 0)
    if (parsed.length === 0) return
    create.mutate({ name, steps: parsed })
    setName('')
    setSteps([{ delay_minutes: '0', channels: '' }])
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wide mb-3">Escalation policies</h2>
        <div className="card p-5">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Policy name</label>
              <input className="input" placeholder="e.g. PagerDuty chain" value={name} onChange={e => setName(e.target.value)} />
            </div>
            {steps.map((st, i) => (
              <div key={i} className="grid sm:grid-cols-3 gap-3 rounded-lg border border-surface-800 p-3">
                <div>
                  <label className="label">Step {i + 1} – delay (minutes)</label>
                  <input className="input" type="number" min={0} value={st.delay_minutes} onChange={e => { const a = [...steps]; a[i].delay_minutes = e.target.value; setSteps(a) }} />
                  <p className="text-xs text-surface-600 mt-1">{i === 0 ? 'Fires immediately on DOWN' : `Fires ${st.delay_minutes}m after still DOWN`}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Channels (one per line: type:target)</label>
                  <textarea className="input font-mono text-xs" rows={2} placeholder={'email:oncall@example.com\ndiscord:https://discord.com/api/webhooks/...'} value={st.channels} onChange={e => { const a = [...steps]; a[i].channels = e.target.value; setSteps(a) }} />
                </div>
                <div className="sm:col-span-3 flex justify-end">
                  <button type="button" className="btn-ghost text-xs" onClick={() => setSteps(steps.filter((_, x) => x !== i))} disabled={steps.length === 1}>Remove step</button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => setSteps([...steps, { delay_minutes: '5', channels: '' }])}>+ Add step</button>
              <button type="submit" disabled={!canSubmit || create.isPending} className="btn bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-40 ml-auto">{create.isPending ? 'Saving…' : 'Create policy'}</button>
            </div>
          </form>
        </div>
      </div>
      {isLoading ? <div className="card animate-pulse h-12 bg-surface-800" /> : !policies || policies.length === 0 ? <p className="text-sm text-surface-600">No escalation policies yet.</p> : (
        <div className="card overflow-hidden p-0">
          <ul className="divide-y divide-surface-800">
            {policies.map(p => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100">{p.name}</p>
                  <p className="text-xs text-surface-600">{p.steps.map((s: any, i: number) => `Step ${i + 1} @${s.delay_minutes}m → ${(s.channels || []).map((c: any) => c.type).join(',')}`).join(' · ')}</p>
                </div>
                <button onClick={() => { if (confirm(`Delete policy "${p.name}"? Monitors using it will fall back to immediate channels.`)) remove.mutate(p.id) }} className="btn-ghost text-xs shrink-0">Delete</button>
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