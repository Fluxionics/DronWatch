import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase'

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string }
}

export interface AccessTokenPayload {
  id: string
  email?: string
  type: 'access'
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = header.slice(7)

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload
    if (payload.type !== 'access' || !payload.id) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.user = { id: payload.id, email: payload.email }
    next()
  } catch {
    const apiKey = req.headers['x-api-key'] as string
    if (apiKey) {
      return handleApiKey(apiKey, req, res, next)
    }
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

async function handleApiKey(
  key: string,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const crypto = await import('crypto')
  const hash = crypto.createHash('sha256').update(key).digest('hex')

  const { data } = await supabase
    .from('api_keys')
    .select('user_id, users(id, email)')
    .eq('key_hash', hash)
    .single()

  if (!data) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash)

  const user = data.users as unknown as { id: string; email?: string }
  req.user = { id: user.id, email: user.email }
  next()
}