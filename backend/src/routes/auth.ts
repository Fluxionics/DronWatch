import { Router, Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomUUID } from 'crypto'
import { supabase } from '../config/supabase'
import { validate } from '../middleware/validate'

const router = Router()

export const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/

const registerSchema = z.object({
  username: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores and dashes'),
  email: z.string().trim().email().toLowerCase().optional().or(z.literal('').transform(() => undefined)),
  password: z.string().min(8).max(128).regex(PASSWORD_POLICY, 'Password must be 8+ characters and include at least one letter and one number')
})

const loginSchema = z.object({
  username: z.string().trim(),
  password: z.string().min(1)
})

const forgotSchema = z.object({
  email: z.string().trim().email().toLowerCase()
})

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128).regex(PASSWORD_POLICY, 'Password must be 8+ characters and include at least one letter and one number')
})

const refreshSchema = z.object({
  refresh: z.string().min(10)
})

const accessExpires = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn']
const refreshExpires = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn']
const refreshMs = (() => {
  const d = (process.env.JWT_REFRESH_EXPIRES_IN || '7d')
  const n = parseInt(d, 10)
  if (d.endsWith('d')) return n * 86400000
  if (d.endsWith('h')) return n * 3600000
  if (d.endsWith('m')) return n * 60000
  return 7 * 86400000
})()

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function signAccess(user: { id: string; email: string }) {
  return jwt.sign({ id: user.id, email: user.email, type: 'access' }, process.env.JWT_SECRET!, { expiresIn: accessExpires })
}

async function createSession(userId: string): Promise<string> {
  const sid = randomUUID()
  const refresh = jwt.sign({ sid, type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: refreshExpires })
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId, token_hash: sha256(refresh), expires_at: new Date(Date.now() + refreshMs).toISOString()
  })
  if (error) throw new Error(error.message)
  return refresh
}

async function revokeSession(refresh: string) {
  await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', sha256(refresh)).is('revoked_at', null)
}

async function revokeAllSessions(userId: string) {
  await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).is('revoked_at', null)
}

const loginFailures = new Map<string, { count: number; until: number }>()

function keyOf(ip: string, username: string): string {
  return `${ip}|${String(username).toLowerCase().trim()}`
}

function isLocked(ip: string, username: string): boolean {
  const e = loginFailures.get(keyOf(ip, username))
  if (!e) return false
  if (e.until && Date.now() > e.until) { loginFailures.delete(keyOf(ip, username)); return false }
  return e.count >= 5
}

function recordFailure(ip: string, username: string) {
  const k = keyOf(ip, username)
  const e = loginFailures.get(k) || { count: 0, until: 0 }
  const count = e.count + 1
  const until = count >= 5 ? Date.now() + 15 * 60000 : e.until
  loginFailures.set(k, { count, until })
}

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { username, email, password } = req.body

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Username already taken' })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const { data: user, error } = await supabase
    .from('users')
    .insert({ username, password_hash, ...(email ? { email } : {}) })
    .select('id, username, email, free_tier, created_at')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message || 'Failed to create account' })
  }

  const refresh = await createSession(user.id)
  const access = signAccess({ id: user.id, email: user.email ?? '' })

  res.status(201).json({ user, access, refresh })
})

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown'
  const { username, password } = req.body
  if (isLocked(ip, username)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, username, email, password_hash, free_tier')
    .eq('username', username)
    .single()

  if (!user) {
    recordFailure(ip, username)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    recordFailure(ip, username)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  loginFailures.delete(keyOf(ip, username))

  const { password_hash: _, ...safeUser } = user
  const refresh = await createSession(user.id)
  const access = signAccess({ id: user.id, email: user.email ?? '' })

  res.json({ user: safeUser, access, refresh })
})

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
  const { refresh } = req.body

  let payload: any
  try {
    payload = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET!)
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
  if (payload.type !== 'refresh' || !payload.sid) {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }

  const tokenHash = sha256(refresh)
  const { data: session } = await supabase.from('user_sessions').select('id, user_id, revoked_at, expires_at').eq('token_hash', tokenHash).single()
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'Refresh token revoked or expired' })
  }

  await revokeSession(refresh)
  const { data: user } = await supabase.from('users').select('id, email').eq('id', session.user_id).single()
  if (!user) return res.status(401).json({ error: 'User no longer exists' })

  const newRefresh = await createSession(user.id)
  const access = signAccess({ id: user.id, email: user.email ?? '' })

  res.json({ access, refresh: newRefresh })
})

router.post('/logout', async (req: Request, res: Response) => {
  const refresh = typeof req.body?.refresh === 'string' ? req.body.refresh : ''
  if (!refresh) return res.status(400).json({ error: 'Refresh token required' })
  await revokeSession(refresh)
  res.status(204).send()
})

router.post('/forgot-password', validate(forgotSchema), async (_req, res) => {
  res.json({ message: 'If an account exists with that email, a reset link has been sent' })
})

router.post('/reset-password', validate(resetSchema), async (req: Request, res: Response) => {
  const { token, password } = req.body

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; type?: string }
    if (payload.type !== 'reset' || !payload.id) throw new Error('Invalid reset token')
    const password_hash = await bcrypt.hash(password, 12)

    await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', payload.id)

    await revokeAllSessions(payload.id)

    res.json({ message: 'Password updated' })
  } catch {
    res.status(400).json({ error: 'Invalid or expired token' })
  }
})

export default router