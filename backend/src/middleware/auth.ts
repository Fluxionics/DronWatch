import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase'

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string }
  agent?: { id: string; user_id: string }
}

export interface AccessTokenPayload {
  id: string
  email?: string
  type: 'access'
}

function sha256(s: string): string {
  return require('crypto').createHash('sha256').update(s).digest('hex')
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const agentToken = req.headers['x-agent-token'] as string | undefined
  if (agentToken) {
    const hash = sha256(agentToken)
    const { data: agent } = await supabase.from('agents').select('id, user_id').eq('token_hash', hash).single()
    if (!agent) {
      return res.status(401).json({ error: 'Invalid agent token' })
    }
    req.user = { id: agent.user_id }
    req.agent = { id: agent.id, user_id: agent.user_id }
    return next()
  }

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