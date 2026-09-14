import { Router, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { PASSWORD_POLICY } from './auth'
import { PLAN_LIMITS, PLAN_NAMES } from '../services/plans'

const router = Router()

router.use(requireAuth)

const profileSchema = z.object({
  username: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores and dashes')
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8).max(128).regex(PASSWORD_POLICY, 'Password must be 8+ characters and include at least one letter and one number')
})

const envVarKey = /^[a-zA-Z0-9_-]{1,64}$/
const envVarSchema = z.object({
  vars: z.record(z.string(), z.string().max(5000)).refine(vars => Object.keys(vars).length <= 50, 'Too many variables (max 50)').refine(vars => Object.keys(vars).every(k => envVarKey.test(String(k).trim())), 'Invalid variable key')
})

const apiKeySchema = z.object({
  label: z.string().trim().min(1).max(100)
})

const reportSchema = z.object({
  email: z.string().trim().email(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  days: z.number().int().min(1).max(365).default(30)
})

const planSchema = z.object({
  plan: z.enum(PLAN_NAMES)
})

async function revokeAllSessions(userId: string) {
  await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).is('revoked_at', null)
}

router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, free_tier, plan, created_at')
    .eq('id', req.user!.id)
    .single()

  if (error || !data) return res.status(404).json({ error: 'User not found' })
  res.json(data)
})

router.put('/profile', validate(profileSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .update({ username: req.body.username })
    .eq('id', req.user!.id)
    .select('id, username, email, free_tier, plan, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/plans', async (_req: AuthenticatedRequest, res: Response) => {
  res.json(PLAN_NAMES.map(p => ({ name: p, limits: PLAN_LIMITS[p] })))
})

router.put('/plan', validate(planSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .update({ plan: req.body.plan })
    .eq('id', req.user!.id)
    .select('id, plan')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.put('/password', validate(passwordSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('id', req.user!.id)
    .single()

  if (!user) return res.status(404).json({ error: 'User not found' })

  const matches = await bcrypt.compare(req.body.current_password, user.password_hash)
  if (!matches) return res.status(401).json({ error: 'Current password is incorrect' })

  const password_hash = await bcrypt.hash(req.body.new_password, 12)

  const { error } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', req.user!.id)

  if (error) return res.status(500).json({ error: error.message })

  await revokeAllSessions(req.user!.id)

  res.status(204).send()
})

router.delete('/', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', req.user!.id)

  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

router.get('/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, created_at, last_used_at')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/api-keys', validate(apiKeySchema), async (req: AuthenticatedRequest, res: Response) => {
  const { label } = req.body

  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user!.id)
  if ((count ?? 0) >= 20) return res.status(400).json({ error: 'API key limit reached (max 20)' })

  const key = `dw_${randomBytes(32).toString('hex')}`
  const key_hash = createHash('sha256').update(key).digest('hex')

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: req.user!.id, key_hash, label })
    .select('id, label, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ...data, key })
})

router.delete('/api-keys/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)

  if (error) return res.status(404).json({ error: 'API key not found' })
  res.status(204).send()
})

router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitors } = await supabase
    .from('monitors')
    .select('id, last_status')
    .eq('user_id', req.user!.id)

  const total = monitors?.length ?? 0
  const up = monitors?.filter(m => m.last_status === true).length ?? 0
  const down = monitors?.filter(m => m.last_status === false).length ?? 0
  const unknown = monitors?.filter(m => m.last_status === null).length ?? 0

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const monitorIds = monitors?.map(m => m.id) ?? []

  const { count: alertCount } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .in('monitor_id', monitorIds.length > 0 ? monitorIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('sent_at', since.toISOString())

  res.json({ total, up, down, unknown, alerts_this_month: alertCount ?? 0 })
})

router.get('/env-vars', async (req: AuthenticatedRequest, res: Response) => {
  const [{ data: user }, { data: rows }] = await Promise.all([
    supabase.from('users').select('env_vars').eq('id', req.user!.id).single(),
    supabase.from('user_env_vars').select('key, value').eq('user_id', req.user!.id)
  ])
  const masked: Record<string, string> = Object.fromEntries(Object.entries(user?.env_vars || {}).map(([k, v]) => [k, String(v).length > 4 ? '****' + String(v).slice(-4) : '****']))
  for (const r of rows || []) masked[r.key] = String(r.value).length > 4 ? '****' + String(r.value).slice(-4) : '****'
  res.json(masked)
})

router.put('/env-vars', validate(envVarSchema), async (req: AuthenticatedRequest, res: Response) => {
  const vars = req.body.vars
  for (const [key, value] of Object.entries(vars)) {
    const k = String(key).trim()
    if (!k) continue
    const v = String(value ?? '')
    if (!v) await supabase.from('user_env_vars').delete().eq('user_id', req.user!.id).eq('key', k)
    else await supabase.from('user_env_vars').upsert({ user_id: req.user!.id, key: k, value: v }, { onConflict: 'user_id,key' })
  }
  await supabase.from('audit_logs').insert({ user_id: req.user!.id, action: 'env_vars.updated' })
  res.json({ ok: true })
})

router.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('report_schedules').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/reports', validate(reportSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { email, frequency, days } = req.body
  const next = new Date(); next.setDate(next.getDate() + (frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30))
  const { data, error } = await supabase.from('report_schedules').insert({ user_id: req.user!.id, email, frequency, days, next_at: next.toISOString() }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.delete('/reports/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase.from('report_schedules').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  if (error) return res.status(404).json({ error: 'Schedule not found' })
  res.status(204).send()
})

export default router
