import { Router, Response } from 'express'
import { supabase } from '../config/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

router.use(requireAuth)

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
