import { Router, Response } from 'express'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('maintenance_windows').select('*').eq('user_id', req.user!.id).order('starts_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { title, monitor_ids, starts_at, ends_at } = req.body
  if (!title || !starts_at || !ends_at) return res.status(400).json({ error: 'title, starts_at, ends_at required' })
  const { data, error } = await supabase.from('maintenance_windows').insert({ user_id: req.user!.id, title, monitor_ids: monitor_ids || [], starts_at, ends_at }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase.from('maintenance_windows').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

router.post('/silence', async (req: AuthenticatedRequest, res: Response) => {
  const { monitor_id, ends_at } = req.body
  if (!ends_at) return res.status(400).json({ error: 'ends_at required' })
  const { data, error } = await supabase.from('silences').insert({ user_id: req.user!.id, monitor_id: monitor_id || null, ends_at }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.get('/silences', async (req: AuthenticatedRequest, res: Response) => {
  const { data } = await supabase.from('silences').select('*').eq('user_id', req.user!.id).gte('ends_at', new Date().toISOString())
  res.json(data)
})

router.delete('/silence/:id', async (req: AuthenticatedRequest, res: Response) => {
  await supabase.from('silences').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  res.status(204).send()
})

export default router
