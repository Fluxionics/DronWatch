import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { requireAuth, forbidAgents, AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(requireAuth, forbidAgents)

const stepSchema = z.object({
  delay_minutes: z.number().int().min(0).max(10080),
  channels: z.array(z.object({ type: z.string().min(1), target: z.string().min(1).max(500) })).min(1).max(10)
})

const policySchema = z.object({
  name: z.string().trim().min(1).max(100),
  steps: z.array(stepSchema).min(1).max(10)
})

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('escalation_policies').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', validate(policySchema), async (req: AuthenticatedRequest, res: Response) => {
  const { name, steps } = req.body
  const { data, error } = await supabase.from('escalation_policies').insert({ user_id: req.user!.id, name, steps }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/:id', validate(policySchema), async (req: AuthenticatedRequest, res: Response) => {
  const { name, steps } = req.body
  const { data, error } = await supabase.from('escalation_policies').update({ name, steps }).eq('id', req.params.id).eq('user_id', req.user!.id).select().single()
  if (error || !data) return res.status(404).json({ error: error?.message || 'Not found' })
  res.json(data)
})

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase.from('escalation_policies').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  if (error) return res.status(500).json({ error: error.message })
  // also clear references
  await supabase.from('monitors').update({ escalation_policy_id: null }).eq('escalation_policy_id', req.params.id).eq('user_id', req.user!.id)
  res.status(204).send()
})

export default router
