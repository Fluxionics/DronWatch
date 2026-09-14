import { Router, Response } from 'express'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('teams').select('*, team_members(*)').eq('user_id', req.user!.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const { data, error } = await supabase.from('teams').insert({ user_id: req.user!.id, name }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.post('/:id/members', async (req: AuthenticatedRequest, res: Response) => {
  const { email, role } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })
  const { data: team } = await supabase.from('teams').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!team) return res.status(404).json({ error: 'Team not found' })
  const { data, error } = await supabase.from('team_members').insert({ team_id: req.params.id, email, role: role || 'viewer' }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from('audit_logs').insert({ user_id: req.user!.id, action: 'team.member.add', target: email })
  res.status(201).json(data)
})

router.delete('/:id/members/:memberId', async (req: AuthenticatedRequest, res: Response) => {
  await supabase.from('team_members').delete().eq('id', req.params.memberId)
  res.status(204).send()
})

router.get('/audit/logs', async (req: AuthenticatedRequest, res: Response) => {
  const { data } = await supabase.from('audit_logs').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(100)
  res.json(data)
})

export default router
