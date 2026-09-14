import { Router, Response } from 'express'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { status, severity, search } = req.query
  let query = supabase.from('incidents').select('*, monitors(name, url)').eq('user_id', req.user!.id)
  if (status) query = query.eq('status', String(status))
  if (severity) query = query.eq('severity', String(severity))
  if (search) query = query.ilike('title', `%${search}%`)
  const { data, error } = await query.order('started_at', { ascending: false }).limit(200)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('incidents').select('*, monitors(name, url), incident_updates(*), incident_tasks(*)').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (error || !data) return res.status(404).json({ error: 'Incident not found' })
  const { data: postmortem } = await supabase.from('incident_postmortems').select('*').eq('incident_id', data.id).maybeSingle()
  res.json({ ...data, postmortem })
})

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { severity, assignee, tags, title } = req.body
  const body: any = {}
  if (severity !== undefined) body.severity = severity
  if (assignee !== undefined) body.assignee = assignee
  if (tags !== undefined) body.tags = tags
  if (title !== undefined) body.title = title
  const { data, error } = await supabase.from('incidents').update(body).eq('id', req.params.id).eq('user_id', req.user!.id).select().single()
  if (error || !data) return res.status(404).json({ error: 'Incident not found' })
  res.json(data)
})

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { monitor_id, title, severity, assignee, tags, message } = req.body
  if (!monitor_id || !title) return res.status(400).json({ error: 'monitor_id and title required' })
  const { data: mon } = await supabase.from('monitors').select('id, user_id').eq('id', monitor_id).eq('user_id', req.user!.id).single()
  if (!mon) return res.status(404).json({ error: 'Monitor not found' })
  const { data: inc, error } = await supabase.from('incidents').insert({
    monitor_id, user_id: req.user!.id, title, severity: severity || 'medium', assignee: assignee || null, tags: tags || []
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from('incident_updates').insert({ incident_id: inc.id, status: 'investigating', message: message || `Incident "${title}" opened manually.` })
  res.status(201).json(inc)
})

const lifecycle: Record<string, { status: string; field: string | null; text: string }> = {
  acknowledge: { status: 'acknowledged', field: 'acknowledged_at', text: 'Acknowledged by operator' },
  investigating: { status: 'resolving', field: null, text: 'Investigating' },
  identified: { status: 'resolving', field: null, text: 'Root cause identified' },
  mitigating: { status: 'resolving', field: null, text: 'Mitigation in progress' },
  monitoring: { status: 'resolving', field: null, text: 'Monitoring recovery' },
  resolving: { status: 'resolving', field: null, text: 'Resolving' },
  resolve: { status: 'resolved', field: 'resolved_at', text: 'Resolved' },
  close: { status: 'closed', field: 'closed_at', text: 'Incident closed' },
  reopen: { status: 'reopened', field: null, text: 'Incident reopened' }
}

router.post('/:id/update', async (req: AuthenticatedRequest, res: Response) => {
  const { message, status, visibility } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })
  const { data: inc } = await supabase.from('incidents').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!inc) return res.status(404).json({ error: 'Incident not found' })
  const { data } = await supabase.from('incident_updates').insert({ incident_id: req.params.id, status: status || 'investigating', message, visibility: visibility || 'public' }).select().single()
  res.status(201).json(data)
})

router.post('/:id/tasks', async (req: AuthenticatedRequest, res: Response) => {
  const { title } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  const { data } = await supabase.from('incident_tasks').insert({ incident_id: req.params.id, title }).select().single()
  res.status(201).json(data)
})

router.patch('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('incident_tasks').update({ done: req.body.done }).eq('id', req.params.taskId).select().single()
  if (error || !data) return res.status(404).json({ error: 'Task not found' })
  res.json(data)
})

router.post('/:id/postmortem', async (req: AuthenticatedRequest, res: Response) => {
  const { root_cause, timeline, actions } = req.body
  const { data: existing } = await supabase.from('incident_postmortems').select('id').eq('incident_id', req.params.id).maybeSingle()
  let result: any
  if (existing) {
    const { data } = await supabase.from('incident_postmortems').update({ root_cause, timeline, actions }).eq('id', existing.id).select().single()
    result = data
  } else {
    const { data } = await supabase.from('incident_postmortems').insert({ incident_id: req.params.id, root_cause, timeline, actions }).select().single()
    result = data
  }
  res.json(result)
})

router.post('/:id/:action', async (req: AuthenticatedRequest, res: Response) => {
  const action = lifecycle[req.params.action]
  if (!action) return res.status(400).json({ error: 'Unknown action' })
  const body: any = { status: action.status }
  if (action.field) body[action.field] = new Date().toISOString()
  const { data, error } = await supabase.from('incidents').update(body).eq('id', req.params.id).eq('user_id', req.user!.id).select().single()
  if (error || !data) return res.status(404).json({ error: 'Incident not found' })
  const label = req.params.action === 'identified' ? 'identified' : req.params.action === 'monitoring' ? 'monitoring' : req.params.action
  await supabase.from('incident_updates').insert({ incident_id: data.id, status: label, message: req.body.message || action.text })
  res.json(data)
})

export default router