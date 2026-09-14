import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '../hooks/useUser'
import { User } from '../types'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Settings() {
  useDocumentTitle('Settings · DronWatch')
  const { user, setAuth, logout, accessToken, refreshToken } = useAuthStore()
  const qc = useQueryClient()
  const [username, setUsername] = useState(user?.username || '')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const { data: apiKeys } = useApiKeys()
  const createKey = useCreateApiKey()
  const deleteKey = useDeleteApiKey()

  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })

  const changePassword = useMutation({
    mutationFn: async () => {
      await api.put('/api/user/password', {
        current_password: pw.current,
        new_password: pw.next
      })
    },
    onSuccess: () => {
      setPw({ current: '', next: '', confirm: '' })
      toast.success('Password changed')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to change password')
    }
  })

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) {
      toast.error('New passwords do not match')
      return
    }
    changePassword.mutate()
  }

  const deleteAccount = useMutation({
    mutationFn: async () => {
      await api.delete('/api/user')
    },
    onSuccess: () => {
      logout()
      toast.success('Account deleted')
      navigate('/')
    },
    onError: () => toast.error('Failed to delete account')
  })

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/api/user/profile', { username })
      return data as User
    },
    onSuccess: (data) => {
      setAuth(data, accessToken!, refreshToken!)
      qc.invalidateQueries({ queryKey: ['user'] })
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile')
  })

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) return
    createKey.mutate(newKeyLabel, {
      onSuccess: (data: any) => {
        setCreatedKey(data.key)
        setNewKeyLabel('')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-surface-50">Settings</h1>

      <section className="card space-y-4">
        <h2 className="font-semibold text-surface-100">Profile</h2>

        <div>
          <label className="label">Username</label>
          <input
            type="text"
            className="input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            minLength={2}
            maxLength={30}
            pattern="[a-zA-Z0-9_-]+"
          />
        </div>

        <div>
          <label className="label">Email <span className="text-surface-600 font-normal">(optional)</span></label>
          <input
            type="email"
            className="input opacity-60"
            value={user?.email || ''}
            disabled
            placeholder="Not set"
          />
          <p className="text-xs text-surface-600 mt-1">Only used to recover your password.</p>
        </div>

        <button
          onClick={() => updateProfile.mutate()}
          disabled={updateProfile.isPending || username === user?.username}
          className="btn-primary"
        >
          {updateProfile.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-surface-100">API Keys</h2>
        <p className="text-sm text-surface-400">
          Use API keys to authenticate requests from your own integrations.
        </p>

        {createdKey && (
          <div className="rounded-lg border border-emerald-800/50 bg-emerald-900/20 p-4">
            <p className="text-xs text-emerald-300 mb-2 font-medium">
              Copy this key now. It won't be shown again.
            </p>
            <code className="block font-mono text-xs text-surface-100 bg-surface-950 rounded px-3 py-2 break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey)
                toast.success('Copied to clipboard')
              }}
              className="btn-ghost text-xs mt-2"
            >
              Copy
            </button>
            <button
              onClick={() => setCreatedKey(null)}
              className="btn-ghost text-xs mt-2 ml-2 text-surface-500"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Label, e.g. CI pipeline"
            value={newKeyLabel}
            onChange={e => setNewKeyLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
          />
          <button
            onClick={handleCreateKey}
            disabled={createKey.isPending || !newKeyLabel.trim()}
            className="btn-primary whitespace-nowrap"
          >
            Generate
          </button>
        </div>

        {apiKeys && apiKeys.length > 0 && (
          <ul className="space-y-2">
            {apiKeys.map(key => (
              <li key={key.id} className="flex items-center gap-3 py-2 border-b border-surface-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-200">{key.label}</p>
                  <p className="text-xs text-surface-500">
                    Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                    {key.last_used_at && ` · Last used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`}
                  </p>
                </div>
                <button
                  onClick={() => confirm('Revoke this API key?') && deleteKey.mutate(key.id)}
                  disabled={deleteKey.isPending}
                  className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold text-surface-100 mb-1">Password</h2>
        <p className="text-sm text-surface-400 mb-4">Use a strong, unique password.</p>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              required
              autoComplete="current-password"
              value={pw.current}
              onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="input"
                required
                minLength={8}
                pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
                autoComplete="new-password"
                value={pw.next}
                onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
              />
              <p className="text-xs text-surface-600 mt-1">At least 8 characters with at least one letter and one number</p>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                className="input"
                required
                minLength={8}
                autoComplete="new-password"
                value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending || pw.next !== pw.confirm || pw.next.length < 8}
            className="btn-primary"
          >
            {changePassword.isPending ? 'Updating...' : 'Change password'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="font-semibold text-surface-100 mb-4">Plan</h2>
        <p className="text-sm text-surface-400">
          Everything is <span className="text-emerald-400 font-medium">free forever</span>. No limits on
          monitors, status pages, or check history. The premium features other tools charge for are
          included in the free plan.
        </p>
      </section>

      <EnvVarsSection />
      <ReportsSection />

      <section className="card border-red-900/40">
        <h2 className="font-semibold text-red-400 mb-4">Danger zone</h2>
        <p className="text-sm text-surface-400 mb-4">
          Deleting your account permanently removes your monitors, status pages, alert history, and
          API keys. This cannot be undone.
        </p>
        <input
          type="text"
          className="input mb-3"
          placeholder={`Type "${user?.username}" to confirm`}
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
        />
        <button
          onClick={() => deleteAccount.mutate()}
          disabled={deleteAccount.isPending || confirmText !== user?.username}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            confirmText === user?.username && user?.username
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-surface-800 text-surface-600 cursor-not-allowed'
          )}
        >
          {deleteAccount.isPending ? 'Deleting...' : 'Delete account'}
        </button>
      </section>
    </div>
  )
}

function EnvVarsSection() {
  const qc = useQueryClient()
  const { data: vars } = useQuery({ queryKey: ['env-vars'], queryFn: async () => { const { data } = await api.get('/api/user/env-vars'); return data as Record<string, string> } })
  const [pairs, setPairs] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }])

  const save = useMutation({
    mutationFn: async () => {
      const vars: Record<string, string> = {}
      for (const p of pairs) if (p.key.trim()) vars[p.key.trim()] = p.value.trim()
      await api.put('/api/user/env-vars', { vars })
    },
    onSuccess: () => { toast.success('Environment variables updated'); qc.invalidateQueries({ queryKey: ['env-vars'] }) },
    onError: () => toast.error('Failed to update variables')
  })

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-surface-100">Environment variables</h2>
      <p className="text-sm text-surface-400">Reusable secrets interpolated into monitors as <code className="text-brand-400 font-mono text-xs">{'{{key}}'}</code>.</p>
      {vars && Object.keys(vars).length > 0 && (
        <div className="space-y-1">
          {Object.entries(vars).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 rounded-lg bg-surface-800 px-3 py-2 text-sm">
              <span className="font-mono text-surface-300">{k}</span>
              <span className="flex-1 text-xs font-mono text-surface-500">{v}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input className="input font-mono flex-1" placeholder="key" value={p.key} onChange={e => { const a = [...pairs]; a[i] = { ...a[i], key: e.target.value }; setPairs(a) }} />
            <input className="input font-mono flex-1" placeholder="value (e.g. {{api_token}} used in monitors)" value={p.value} onChange={e => { const a = [...pairs]; a[i] = { ...a[i], value: e.target.value }; setPairs(a) }} />
            <button className="btn-ghost" onClick={() => setPairs(pairs.filter((_, x) => x !== i))}>Remove</button>
          </div>
        ))}
        <button className="btn-ghost text-xs" onClick={() => setPairs([...pairs, { key: '', value: '' }])}>+ Add variable</button>
      </div>
      <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save variables'}</button>
    </section>
  )
}

function ReportsSection() {
  const qc = useQueryClient()
  const { data: reports } = useQuery({ queryKey: ['reports'], queryFn: async () => { const { data } = await api.get('/api/user/reports'); return data } })
  const [email, setEmail] = useState('')
  const [freq, setFreq] = useState('weekly')

  const create = useMutation({
    mutationFn: async () => { await api.post('/api/user/reports', { email, frequency: freq, days: 30 }) },
    onSuccess: () => { toast.success('Report scheduled'); qc.invalidateQueries({ queryKey: ['reports'] }) }
  })
  const del = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/user/reports/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] })
  })

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-surface-100">Scheduled reports</h2>
      <p className="text-sm text-surface-400">Automatic uptime, latency, MTTA/MTTR and error-budget emails.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        <input type="email" className="input" placeholder="reports@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <select className="input" value={freq} onChange={e => setFreq(e.target.value)}>
          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
        </select>
        <button className="btn-primary" onClick={() => email && create.mutate()} disabled={create.isPending || !email}>Schedule</button>
      </div>
      {reports && reports.length > 0 && (
        <ul className="space-y-2">
          {(reports as any[]).map(r => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg bg-surface-800 px-3 py-2 text-sm">
              <span className="text-surface-300">{r.email}</span>
              <span className="text-xs text-surface-500 capitalize">{r.frequency} · last {r.days} days</span>
              <button className="btn-ghost text-xs ml-auto text-red-400" onClick={() => del.mutate(r.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
