import { Router, Response } from 'express'
import { createHash } from 'crypto'
import { supabase } from '../config/supabase'
import { requireAuth, forbidAgents, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal']

router.post('/ingest', async (req, res) => {
  const { api_key, user_id } = req.query
  let ownerId: string | null = null
  if (api_key) {
    const hash = createHash('sha256').update(String(api_key)).digest('hex')
    const { data: key } = await supabase.from('api_keys').select('user_id').eq('key_hash', hash).single()
    if (key) { ownerId = key.user_id; await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash) }
  } else if (user_id) {
    ownerId = String(user_id)
  }
  if (!ownerId) return res.status(401).json({ error: 'Valid API key or user_id required' })
  const entries = Array.isArray(req.body) ? req.body : [req.body]
  const rows = entries.slice(0, 500).map((e: any) => {
    const level = LEVELS.includes(String(e.level || 'info')) ? String(e.level) : 'info'
    const tags = Array.isArray(e.tags) ? e.tags.slice(0, 20).map((t: any) => String(t).slice(0, 100)) : []
    return {
      user_id: ownerId, monitor_id: e.monitor_id || null, agent_id: e.agent_id || null,
      service: String(e.service || 'app').slice(0, 200), level,
      message: String(e.message || '').slice(0, 4000), tags
    }
  })
  const { error } = await supabase.from('logs').insert(rows)
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ok: true, ingested: rows.length })
})

router.use(requireAuth, forbidAgents)

router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  const { q, level, service, monitor_id, limit } = req.query
  let query = supabase.from('logs').select('*').eq('user_id', req.user!.id)
  if (q) query = query.ilike('message', `%${q}%`)
  if (level) query = query.eq('level', String(level))
  if (service) query = query.ilike('service', `%${service}%`)
  if (monitor_id) query = query.eq('monitor_id', String(monitor_id))
  const { data, error } = await query.order('ts', { ascending: false }).limit(Math.min(parseInt(limit as string) || 100, 500))
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/levels', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('logs').select('level').eq('user_id', req.user!.id)
  if (error) return res.status(500).json({ error: error.message })
  const counts: Record<string, number> = {}
  for (const r of data || []) counts[r.level] = (counts[r.level] || 0) + 1
  res.json(counts)
})

export default router