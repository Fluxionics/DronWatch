import { NextFunction, Request, Response } from 'express'
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit'
import { createHash, timingSafeEqual } from 'crypto'

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

export function makeLimiter(max: number, windowMs: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again later.' })
    }
  })
}

export const globalLimiter = makeLimiter(300, 60 * 1000)
export const authStrictLimiter = makeLimiter(20, 15 * 60 * 1000)
export const refreshLimiter = makeLimiter(60, 60 * 1000)
export const passwordLimiter = makeLimiter(20, 15 * 60 * 1000)

export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-store, private, max-age=0')
  next()
}

export function blockUnsafeMethods(req: Request, res: Response, next: NextFunction) {
  if (!ALLOWED_METHODS.includes(req.method.toUpperCase())) {
    res.set('Allow', ALLOWED_METHODS.join(', '))
    return res.status(405).json({ error: 'Method not allowed' })
  }
  next()
}

export function safeEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function validateOrigin(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin
    if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Origin not allowed' })
    }
    next()
  }
}