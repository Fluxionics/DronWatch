import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { requireAuth, forbidAgents, AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { sendAlert } from '../services/alertService'

const router = Router()

router.use(requireAuth, forbidAgents)

const testSchema = z.object({
  monitor_id: z.string().uuid(),
  type: z.enum(['email','slack','discord','webhook','telegram','teams','google_chat','pushover','gotify','mattermost','matrix','pagerduty','opsgenie','twilio_sms','jira','linear','github_issue','gitlab_issue','webpush']),
  recipient: z.string().trim().min(1).max(500)
})

router.post('/test', validate(testSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { monitor_id, type, recipient } = req.body
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id, name')
    .eq('id', monitor_id)
    .eq('user_id', req.user!.id)
    .single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  try {
    await sendAlert({
      monitorId: monitor.id,
      type,
      recipient,
      message: `[TEST] DronWatch test notification for "${monitor.name}" via ${type}. Your channel works.`,
      status: 'down'
    })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message || 'Test notification failed' })
  }
})

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitors } = await supabase
    .from('monitors')
    .select('id')
    .eq('user_id', req.user!.id)

  const ids = monitors?.map(m => m.id) ?? []

  if (ids.length === 0) return res.json([])

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 50
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('alerts')
    .select('*, monitors(name, url)', { count: 'exact' })
    .in('monitor_id', ids)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ data, total: count, page, limit })
})

export default router
