import { Router, Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { authStrictLimiter } from '../middleware/security'
import { assertResourceLimit } from '../services/plans'

const router = Router()

const statusPageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().trim().max(500).optional(),
  monitor_ids: z.array(z.string().uuid()).max(200),
  groups: z.array(z.object({ name: z.string().trim().max(200), monitor_ids: z.array(z.string().uuid()) })).max(50).default([]),
  is_public: z.boolean().default(true),
  password: z.string().min(6).max(200).optional().nullable(),
  custom_domain: z.string().trim().max(253).regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, 'Invalid domain').optional().nullable().or(z.literal('').transform(() => null)),
  background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0f172a'),
  logo_url: z.string().url().optional().nullable(),
  branding_default: z.boolean().default(true),
  subscriptions_enabled: z.boolean().default(true)
})

function rssEncode(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

router.get('/feed/:slug', async (req: Request, res: Response) => {
  const { data: page } = await supabase.from('status_pages').select('*').eq('slug', req.params.slug).single()
  if (!page || !page.is_public) return res.status(404).json({ error: 'Status page not found' })
  const { data: incidents } = await supabase.from('incidents').select('*, monitors(name), incident_updates(message, visibility, created_at)').in('monitor_id', (page.monitor_ids || []).length ? page.monitor_ids : ['00000000-0000-0000-0000-000000000000']).order('started_at', { ascending: false }).limit(20)
  const items = (incidents || []).map(i => {
    const latest = (i.incident_updates || []).filter((u: any) => u.visibility !== 'internal').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    const desc = latest ? `${latest.message} (${latest.created_at ? new Date(latest.created_at).toUTCString() : ''})` : `Status: ${i.status === 'resolved' ? 'operational' : i.status === 'open' ? 'investigating' : i.status}`
    return `    <item>
      <title>${rssEncode(i.title)}</title>
      <link>${rssEncode(process.env.FRONTEND_URL || '')}/status/${rssEncode(page.slug)}</link>
      <guid>${i.id}</guid>
      <pubDate>${new Date(i.started_at).toUTCString()}</pubDate>
      <description>${rssEncode(`${desc} — ${i.monitors?.name || 'monitor'}`)}</description>
    </item>`
  }).join('\n')
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${rssEncode(page.name)}</title>
    <link>${rssEncode(process.env.FRONTEND_URL || '')}/status/${rssEncode(page.slug)}</link>
    <description>${rssEncode(page.description || 'Status updates')}</description>
${items}
  </channel>
</rss>`
  res.set('Content-Type', 'application/rss+xml; charset=utf-8')
  res.send(feed)
})

router.post('/public/:slug/subscribe', authStrictLimiter, async (req: Request, res: Response) => {
  const email = String(req.body?.email || '').toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' })
  if (email.length > 254) return res.status(400).json({ error: 'Valid email required' })
  const { data: page } = await supabase.from('status_pages').select('id, subscriptions_enabled').eq('slug', req.params.slug).single()
  if (!page) return res.status(404).json({ error: 'Status page not found' })
  if (!page.subscriptions_enabled) return res.status(403).json({ error: 'Subscriptions disabled' })
  const { count } = await supabase.from('status_page_subscribers').select('id', { count: 'exact', head: true }).eq('status_page_id', page.id)
  if ((count ?? 0) >= 5000) return res.status(400).json({ error: 'Subscription limit reached' })
  const token = randomBytes(32).toString('hex')
  const { error } = await supabase.from('status_page_subscribers').upsert({ status_page_id: page.id, email, token }, { onConflict: 'status_page_id,email' })
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ok: true, subscribed: email })
})

router.get('/public/:slug/verify', async (req: Request, res: Response) => {
  await supabase.from('status_page_subscribers').update({ verified: true }).eq('token', String(req.query.token || ''))
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/status/${req.params.slug}?verified=1`)
})

router.get('/public/:slug/unsubscribe', async (req: Request, res: Response) => {
  await supabase.from('status_page_subscribers').delete().eq('token', String(req.query.token || ''))
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/status/${req.params.slug}?unsubscribed=1`)
})

async function buildPublicPayload(page: any, res: Response, pwd?: string): Promise<void> {
  if (!page.is_public) {
    if (page.password_hash) {
      if (!pwd || !(await bcrypt.compare(pwd, page.password_hash))) {
        res.status(401).json({ error: 'Password required' })
        return
      }
    } else {
      res.status(403).json({ error: 'Private status page' })
      return
    }
  }

  const monitorIds: string[] = page.monitor_ids

  const { data: monitors } = await supabase
    .from('monitors')
    .select('id, name, url, last_status, last_check, region')
    .in('id', monitorIds.length > 0 ? monitorIds : ['00000000-0000-0000-0000-000000000000'])

  const monitorData = await Promise.all(
    (monitors || []).map(async monitor => {
      const since = new Date(); since.setDate(since.getDate() - 90)
      const { data: checks } = await supabase.from('checks').select('is_up, checked_at').eq('monitor_id', monitor.id).gte('checked_at', since.toISOString()).order('checked_at', { ascending: false }).limit(500)
      const uptime = checks && checks.length > 0 ? Math.round((checks.filter(c => c.is_up).length / checks.length) * 10000) / 100 : null
      const recent = checks?.slice(0, 90).reverse() ?? []
      return { ...monitor, uptime, recent_checks: recent }
    })
  )
  const { data: incidents } = await supabase.from('incidents').select('*, incident_updates(*)').in('monitor_id', monitorIds.length ? monitorIds : ['00000000-0000-0000-0000-000000000000']).order('started_at', { ascending: false }).limit(20)
  const { data: maintenance } = await supabase.from('maintenance_windows').select('*').gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(10)
  res.json({ ...page, monitors: monitorData, incidents: incidents || [], maintenance: maintenance || [] })
}

router.get('/public/:slug', async (req: Request, res: Response) => {
  const { data: page } = await supabase
    .from('status_pages')
    .select('*')
    .eq('slug', req.params.slug)
    .single()

  if (!page) return res.status(404).json({ error: 'Status page not found' })
  await buildPublicPayload(page, res, String(req.query.password || ''))
})

router.get('/domain/:domain', async (req: Request, res: Response) => {
  const domain = String(req.params.domain || '').trim().toLowerCase()
  const { data: page } = await supabase
    .from('status_pages')
    .select('*')
    .eq('custom_domain', domain)
    .single()

  if (!page) return res.status(404).json({ error: 'Status page not found' })
  await buildPublicPayload(page, res, String(req.query.password || ''))
})

router.use(requireAuth)

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('status_pages')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', validate(statusPageSchema), async (req: AuthenticatedRequest, res: Response) => {
  const limit = await assertResourceLimit(req.user!.id, 'status_pages')
  if (!limit.ok) return res.status(402).json({ error: limit.error })
  const body: any = { ...req.body }
  if (body.password) { body.password_hash = await bcrypt.hash(body.password, 10); delete body.password }
  const { data, error } = await supabase.from('status_pages').insert({ ...body, user_id: req.user!.id }).select().single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug already taken' })
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(data)
})

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('status_pages')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Status page not found' })
  const { data: subscribers } = await supabase.from('status_page_subscribers').select('id, email, verified, created_at').eq('status_page_id', data.id).order('created_at', { ascending: false }).limit(200)
  res.json({ ...data, subscribers: subscribers || [] })
})

router.delete('/:id/subscribers/:subscriberId', async (req: AuthenticatedRequest, res: Response) => {
  const { data: page } = await supabase.from('status_pages').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!page) return res.status(404).json({ error: 'Status page not found' })
  await supabase.from('status_page_subscribers').delete().eq('id', req.params.subscriberId).eq('status_page_id', page.id)
  res.status(204).send()
})

router.put('/:id', validate(statusPageSchema), async (req: AuthenticatedRequest, res: Response) => {
  const body: any = { ...req.body }
  if (body.password) { body.password_hash = await bcrypt.hash(body.password, 10); delete body.password }
  if (body.password === null) body.password_hash = null
  const { data, error } = await supabase.from('status_pages').update(body).eq('id', req.params.id).eq('user_id', req.user!.id).select().single()

  if (error || !data) return res.status(404).json({ error: 'Status page not found' })
  res.json(data)
})

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase
    .from('status_pages')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)

  if (error) return res.status(404).json({ error: 'Status page not found' })
  res.status(204).send()
})

export default router
