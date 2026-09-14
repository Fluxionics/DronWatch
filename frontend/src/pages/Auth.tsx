import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLogin, useRegister } from '../hooks/useAuth'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export default function Auth() {
  useDocumentTitle('Sign in · DronWatch')
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(
    params.get('mode') === 'register' ? 'register' : 'login'
  )
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [passwordError, setPasswordError] = useState('')

  const login = useLogin()
  const register = useRegister()

  useEffect(() => {
    setMode(params.get('mode') === 'register' ? 'register' : 'login')
  }, [params])

  const isPending = login.isPending || register.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    if (mode === 'register' && !PASSWORD_RE.test(form.password)) {
      setPasswordError('Password must be at least 8 characters with at least one letter and one number')
      return
    }
    if (mode === 'login') {
      login.mutate({ username: form.username, password: form.password })
    } else {
      register.mutate({
        username: form.username,
        password: form.password,
        email: form.email || undefined
      })
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="font-semibold text-surface-50">DronWatch</span>
          </Link>
          <h1 className="text-xl font-bold text-surface-50">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-brand-400 hover:text-brand-300 transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              className="input"
              placeholder={mode === 'register' ? 'Pick a username' : 'Your username'}
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              minLength={2}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              autoComplete="username"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="label">
                Email <span className="text-surface-600 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
              <p className="text-xs text-surface-600 mt-1">Only used to recover your password. No spam.</p>
            </div>
          )}

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder={mode === 'register' ? 'At least 8 chars, incl. a letter and number' : 'Your password'}
              value={form.password}
              onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setPasswordError('') }}
              required
              minLength={mode === 'register' ? 8 : 1}
              pattern={mode === 'register' ? '(?=.*[A-Za-z])(?=.*\\d).{8,}' : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {passwordError && <p className="text-xs text-red-400 mt-1">{passwordError}</p>}
            {mode === 'login' && (
              <p className="text-xs text-surface-500 mt-2 text-right">
                <Link to="/reset-password" className="text-brand-400 hover:text-brand-300">Forgot password?</Link>
              </p>
            )}
          </div>

          <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
            {isPending
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="text-center text-xs text-surface-600 mt-4">
            Free forever. Unlimited monitors, 1-minute checks, status pages, Slack &amp; Discord alerts — no credit card.
          </p>
        )}
      </div>
    </div>
  )
}
