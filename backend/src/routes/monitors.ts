import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { requireAuth, forbidAgents, AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { checkMonitor, getMonitorStats, getDowntimeEvents, getMonitorReport, getMonitorRegions } from '../services/monitorService'
import { safeEquals } from '../middleware/security'
import { assertResourceLimit, enforceInterval, getUserPlan } from '../services/plans'

const router = Router()

const channelSchema = z.object({
  type: z.enum(['email','slack','discord','webhook','telegram','teams','google_chat','pushover','gotify','mattermost','matrix','pagerduty','opsgenie','twilio_sms','jira','linear','github_issue','gitlab_issue','webpush']),
  target: z.string().trim().min(1).max(500)
})

const monitorSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  name: z.string().trim().min(1).max(200),
  type: z.enum(['http','ping','tcp','keyword','heartbeat','dns','ssl','domain','synthetic']).default('http'),
  config: z.record(z.any()).default({}),
  expected_status: z.number().int().min(100).max(599).nullable().optional(),
  check_interval: z.number().int().min(30).max(3600).default(300),
  retry_count: z.number().int().min(1).max(5).default(1),
  parent_monitor_id: z.string().uuid().nullable().optional(),
  maintenance: z.boolean().default(false),
  priority: z.number().int().min(0).max(3).default(0),
  region: z.string().trim().max(50).default('auto'),
  escalation_policy_id: z.string().uuid().nullable().optional(),
  notification_channels: z.array(channelSchema).max(15).default([])
}).superRefine((data, ctx) => {
  const regions = (data.config as any)?.regions
  if (regions !== undefined) {
    if (!Array.isArray(regions)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'regions must be an array', path: ['config', 'regions'] })
    else if (regions.length > 11) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'max 11 regions', path: ['config', 'regions'] })
  }
  const mode = (data.config as any)?.region_mode
  if (mode !== undefined && !['quorum','all','any'].includes(mode)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'region_mode must be quorum, all or any', path: ['config', 'region_mode'] })
  if (data.type === 'synthetic') {
    const steps = (data.config as any)?.synthetic_steps
    if (!Array.isArray(steps) || steps.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'synthetic monitors require synthetic_steps', path: ['config', 'synthetic_steps'] })
  }
})

router.use(requireAuth, forbidAgents)

router.get('/available-regions', async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('regions').select('code,label,active').eq('active', true).order('code')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id/security', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id, url, type, config').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const { data: latest } = await supabase.from('checks').select('extra, checked_at, status_code').eq('monitor_id', req.params.id).order('checked_at', { ascending: false }).limit(1).maybeSingle()
  const stored = (latest as any)?.extra?.security
  if (stored) return res.json({ ...stored, checked_at: (latest as any).checked_at })
  res.json(null)
})

router.get('/:id/anomalies', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const { data } = await supabase.from('checks').select('id, response_time, extra, checked_at, region').eq('monitor_id', req.params.id).order('checked_at', { ascending: false }).limit(100)
  const anomalies = (data || []).filter((r: any) => r.extra?.anomaly)
  res.json(anomalies.slice(0, 20))
})

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const monitors = data ?? []
  const ids = monitors.map(m => m.id)

  if (ids.length === 0) return res.json([])

  const since = new Date()
  since.setDate(since.getDate() - 90)

  // 90d uptime from pre-aggregated daily buckets (cheap) instead of raw checks.
  let uptimeByMonitor: Record<string, { up: number; total: number }> = {}
  let seriesByMonitor: Record<string, boolean[]> = {}
  const { data: buckets, error: bucketsError } = await supabase
    .from('daily_stats')
    .select('monitor_id, check_count, down_count')
    .in('monitor_id', ids)
    .gte('bucket', since.toISOString())
  if (!bucketsError && buckets && buckets.length > 0) {
    for (const b of buckets) {
      const e = (uptimeByMonitor[b.monitor_id] ??= { up: 0, total: 0 })
      e.total += b.check_count ?? 0
      e.up += (b.check_count ?? 0) - (b.down_count ?? 0)
    }
    // Recent raw checks only for the sparkline series (bounded).
    const { data: recent } = await supabase
      .from('checks')
      .select('monitor_id, is_up, checked_at')
      .in('monitor_id', ids)
      .order('checked_at', { ascending: false })
      .limit(ids.length * 60)
    for (const c of recent ?? []) {
      (seriesByMonitor[c.monitor_id] ??= []).push(c.is_up)
    }
    for (const k of Object.keys(seriesByMonitor)) seriesByMonitor[k].reverse()
  } else {
    // Fresh installs / pre-rollup: bounded raw fallback.
    const { data: checks, error: checksError } = await supabase
      .from('checks')
      .select('monitor_id, is_up')
      .in('monitor_id', ids)
      .gte('checked_at', since.toISOString())
      .order('checked_at', { ascending: false })
      .limit(ids.length * 2000)
    if (checksError) return res.status(500).json({ error: checksError.message })
    for (const check of checks ?? []) {
      (seriesByMonitor[check.monitor_id] ??= []).push(check.is_up)
    }
    for (const m of monitors) {
      const series = seriesByMonitor[m.id] ?? []
      uptimeByMonitor[m.id] = { up: series.filter(v => v).length, total: series.length }
    }
  }

  const enriched = monitors.map(m => {
    const u = uptimeByMonitor[m.id]
    const series = seriesByMonitor[m.id] ?? []
    return {
      ...m,
      uptime_90d: u && u.total > 0 ? Math.round((u.up / u.total) * 10000) / 100 : null,
      uptime_series: series
    }
  })

  res.json(enriched)
})

router.post('/', validate(monitorSchema), async (req: AuthenticatedRequest, res: Response) => {
  const limit = await assertResourceLimit(req.user!.id, 'monitors')
  if (!limit.ok) return res.status(402).json({ error: limit.error })
  const plan = await getUserPlan(req.user!.id)
  const body = { ...req.body, check_interval: enforceInterval(plan, req.body.check_interval) }
  const { data, error } = await supabase
    .from('monitors')
    .insert({ ...body, user_id: req.user!.id })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Monitor not found' })
  res.json(data)
})

router.put('/:id', validate(monitorSchema), async (req: AuthenticatedRequest, res: Response) => {
  const plan = await getUserPlan(req.user!.id)
  const body = { ...req.body, check_interval: enforceInterval(plan, req.body.check_interval) }
  const { data, error } = await supabase
    .from('monitors')
    .update(body)
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select()
    .single()

  if (error || !data) return res.status(404).json({ error: 'Monitor not found' })
  res.json(data)
})

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase
    .from('monitors')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)

  if (error) return res.status(404).json({ error: 'Monitor not found' })
  res.status(204).send()
})

router.post('/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase
    .from('monitors')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })

  try {
    const check = await checkMonitor(monitor)
    res.json(check)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase
    .from('monitors')
    .select('is_active')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })

  const { data, error } = await supabase
    .from('monitors')
    .update({ is_active: !monitor.is_active })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id/checks', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 50
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('checks')
    .select('*', { count: 'exact' })
    .eq('monitor_id', req.params.id)
    .order('checked_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ data, total: count, page, limit })
})

router.get('/:id/stats', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })

  const days = parseInt(req.query.days as string) || 7

  const stats = await getMonitorStats(req.params.id, days)
  res.json(stats)
})

router.get('/:id/downtime', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })

  const events = await getDowntimeEvents(req.params.id)
  res.json(events)
})

router.get('/:id/report', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const report = await getMonitorReport(req.params.id)
  res.json(report)
})

router.get('/:id/regions', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const regions = await getMonitorRegions(req.params.id)
  res.json(regions)
})

router.get('/:id/report.csv', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id, name').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const since = new Date(); since.setDate(since.getDate() - 90)
  const { data: checks } = await supabase.from('checks').select('is_up, response_time, status_code, dns_time, tcp_time, tls_time, ttfb, error_message, checked_at').eq('monitor_id', req.params.id).gte('checked_at', since.toISOString()).order('checked_at', { ascending: false })
  const rows = ['checked_at,is_up,status_code,response_time_ms,dns_ms,tcp_ms,tls_ms,ttfb_ms,error']
  for (const c of checks || []) rows.push(`${c.checked_at},${c.is_up},${c.status_code ?? ''},${c.response_time ?? ''},${c.dns_time ?? ''},${c.tcp_time ?? ''},${c.tls_time ?? ''},${c.ttfb ?? ''},"${(c.error_message || '').replace(/"/g, '""')}"`)
  res.set('Content-Type', 'text/csv')
  res.set('Content-Disposition', `attachment; filename="${monitor.name.replace(/[^a-z0-9]+/gi, '-')}-checks.csv"`)
  res.send(rows.join('\n'))
})

router.get('/:id/report.json', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const report = await getMonitorReport(req.params.id)
  res.set('Content-Disposition', `attachment; filename="report-${req.params.id}.json"`)
  res.send(JSON.stringify(report, null, 2))
})

router.post('/:id/heartbeat', async (req: AuthenticatedRequest, res: Response) => {
  const { data: monitor } = await supabase.from('monitors').select('id, config, user_id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const cfg = { ...(monitor.config as any) }
  cfg.last_ping = new Date().toISOString()
  if (req.body?.duration !== undefined) cfg.last_duration = req.body.duration
  if (req.body?.exit_code !== undefined) cfg.last_exit_code = req.body.exit_code
  if (req.body?.error) cfg.last_error = req.body.error
  cfg.pings = (cfg.pings || 0) + 1
  await supabase.from('monitors').update({ config: cfg }).eq('id', req.params.id)
  res.json({ ok: true, pinged_at: cfg.last_ping })
})

router.post('/heartbeat/:id', async (req, res) => {
  const { data: monitor } = await supabase.from('monitors').select('id, config, type').eq('id', req.params.id).single()
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
  const cfg = { ...(monitor.config as any) }
  if (cfg.token && !safeEquals(String(req.query.token || ''), String(cfg.token))) return res.status(401).json({ error: 'Invalid heartbeat token' })
  cfg.last_ping = new Date().toISOString()
  if (req.body && typeof req.body === 'object') {
    if (req.body.duration !== undefined) cfg.last_duration = req.body.duration
    if (req.body.exit_code !== undefined) cfg.last_exit_code = req.body.exit_code
    if (req.body.status !== undefined) cfg.last_exit_code = req.body.status
    if (req.body.error) cfg.last_error = req.body.error
  }
  if (req.query.start) cfg.last_start = new Date().toISOString()
  if (req.query.msg) cfg.last_error = req.query.msg
  cfg.pings = (cfg.pings || 0) + 1
  await supabase.from('monitors').update({ config: cfg }).eq('id', req.params.id)
  const grace = (monitor.config as any)?.grace_seconds || 300
  res.json({ ok: true, expected_url: `/api/monitors/heartbeat/${req.params.id}?token=${cfg.token || ''}`, grace_seconds: grace })
})

router.post('/:id/maintenance', async (req: AuthenticatedRequest, res: Response) => {
  const { maintenance } = req.body
  const { data, error } = await supabase.from('monitors').update({ maintenance: !!maintenance }).eq('id', req.params.id).eq('user_id', req.user!.id).select().single()
  if (error || !data) return res.status(404).json({ error: 'Monitor not found' })
  res.json(data)
})

router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  const { monitors } = req.body as { monitors: any[] }
  if (!Array.isArray(monitors)) return res.status(400).json({ error: 'monitors array required' })
  const rows = monitors.slice(0, 100).map(m => ({ url: m.url, name: m.name || m.url, type: m.type || 'http', config: m.config || {}, check_interval: m.check_interval || 300, user_id: req.user!.id, notification_channels: m.notification_channels || [] }))
  const { data, error } = await supabase.from('monitors').insert(rows).select()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.get('/export/all', async (req: AuthenticatedRequest, res: Response) => {
  const { data } = await supabase.from('monitors').select('*').eq('user_id', req.user!.id)
  res.json(data)
})

export default router
