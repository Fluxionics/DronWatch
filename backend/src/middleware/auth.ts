import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase'

export type AuthType = 'jwt' | 'api_key' | 'agent'

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string }
  agent?: { id: string; user_id: string }
  authType?: AuthType
  scopes?: string[]
}

export interface AccessTokenPayload {
  id: string
  email?: string
  type: 'access'
}

function sha256(s: string): string {
  return require('crypto').createHash('sha256').update(s).digest('hex')
}

const RESOURCE_ALIASES: Record<string, string> = {
  'status-pages': 'status_pages',
  'alert-rules': 'alert_rules'
}

function requiredScope(req: AuthenticatedRequest): string | null {
  const m = /^\/api\/([^/?]+)/.exec(req.originalUrl || req.url || '')
  if (!m) return null
  const resource = RESOURCE_ALIASES[m[1]] || m[1]
  const action = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? 'read' : 'write'
  return `${resource}:${action}`
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
    req.authType = 'agent'
    return next()
  }

  const apiKey = req.headers['x-api-key'] as string | undefined
  if (apiKey) {
    return handleApiKey(apiKey, req, res, next)
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
    req.authType = 'jwt'
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function forbidAgents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.authType === 'agent') {
    return res.status(403).json({ error: 'Agent tokens are restricted to agent endpoints' })
  }
  next()
}

async function handleApiKey(
  key: string,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const crypto = await import('crypto')
  const hash = crypto.createHash('sha256').update(key).digest('hex')

  let data: any = null
  {
    const r = await supabase
      .from('api_keys')
      .select('user_id, scopes, users(id, email)')
      .eq('key_hash', hash)
      .single()
    if (r.error && /scopes/i.test(r.error.message || '')) {
      const fallback = await supabase
        .from('api_keys')
        .select('user_id, users(id, email)')
        .eq('key_hash', hash)
        .single()
      if (fallback.error || !fallback.data) {
        return res.status(401).json({ error: 'Invalid API key' })
      }
      data = fallback.data
    } else if (r.error || !r.data) {
      return res.status(401).json({ error: 'Invalid API key' })
    } else {
      data = r.data
    }
  }

  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash)

  const user = data.users as unknown as { id: string; email?: string }
  const scopes: string[] = Array.isArray(data.scopes) ? data.scopes : []
  if (scopes.length > 0) {
    const need = requiredScope(req)
    if (need && !scopes.includes(need)) {
      return res.status(403).json({ error: `API key missing required scope: ${need}` })
    }
  }
  req.user = { id: user.id, email: user.email }
  req.authType = 'api_key'
  req.scopes = scopes
  next()
}
