import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export default function ResetPassword() {
  useDocumentTitle('Reset password · DronWatch')
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setPending(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setMessage('If an account exists with that email, a reset link has been sent.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Request failed')
    } finally {
      setPending(false)
    }
  }

  const applyReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!PASSWORD_RE.test(password)) {
      setError('Password must be at least 8 characters with at least one letter and one number')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setPending(true)
    try {
      await api.post('/api/auth/reset-password', { token, password })
      setMessage('Password updated. You can now sign in.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link to="/" className="font-semibold text-surface-50">DronWatch</Link>
          <h1 className="text-xl font-bold text-surface-50 mt-3">Reset password</h1>
        </div>

        <div className="card space-y-4">
          {token ? (
            <form onSubmit={applyReset} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">{pending ? 'Please wait...' : 'Update password'}</button>
            </form>
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
              <div>
                <label className="label">Account email</label>
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">{pending ? 'Please wait...' : 'Send reset link'}</button>
            </form>
          )}
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <p className="text-center text-sm text-surface-500"><Link to="/auth" className="text-brand-400 hover:text-brand-300">Back to sign in</Link></p>
        </div>
      </div>
    </div>
  )
}