import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(requireAuth)

const channelSchema = z.object({
  type: z.enum(['email','slack','discord','webhook','telegram','teams','google_chat','pushover','gotify','mattermost','matrix','pagerduty','opsgenie','twilio_sms','jira','linear','github_issue','gitlab_issue','webpush']),
  target: z.string().trim().min(1).max(500)
})

const ruleSchema = z.object({
  monitor_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  condition: z.enum(['down_for', 'latency_above', 'ssl_expires_within']),
  threshold: z.number().int().min(1).max(100000),
  for_minutes: z.number().int().min(0).max(10080).default(0),
  channels: z.array(channelSchema).max(15).default([]),
  enabled: z.boolean().default(true)
})

const ruleUpdateSchema = ruleSchema.partial().extend({ monitor_id: z.string().uuid().optional() })

async function getOwnedMonitor(userId: string, monitorId: string): Promise<boolean> {
  const { data } = await supabase.from('monitors').select('id').eq('id', monitorId).eq('user_id', userId).single()
  return !!data
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('alert_rules')
    .select('*, monitors(id, name)')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', validate(ruleSchema), async (req: AuthenticatedRequest, res: Response) => {
  const owned = await getOwnedMonitor(req.user!.id, req.body.monitor_id)
  if (!owned) return res.status(404).json({ error: 'Monitor not found' })
  const { data, error } = await supabase.from('alert_rules')
    .insert({ ...req.body, user_id: req.user!.id })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/:id', validate(ruleUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { data: existing } = await supabase.from('alert_rules').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!existing) return res.status(404).json({ error: 'Alert rule not found' })
  if (req.body.monitor_id && req.body.monitor_id !== existing.monitor_id) {
    const owned = await getOwnedMonitor(req.user!.id, req.body.monitor_id)
    if (!owned) return res.status(404).json({ error: 'Monitor not found' })
  }
  const { data, error } = await supabase.from('alert_rules')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select()
    .single()
  if (error || !data) return res.status(404).json({ error: 'Alert rule not found' })
  res.json(data)
})

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase.from('alert_rules').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  if (error) return res.status(404).json({ error: 'Alert rule not found' })
  res.status(204).send()
})

export default router