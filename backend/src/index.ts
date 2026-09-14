import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { supabase } from './config/supabase'
import authRouter from './routes/auth'
import monitorsRouter from './routes/monitors'
import statusPagesRouter from './routes/statusPages'
import userRouter from './routes/user'
import alertsRouter from './routes/alerts'
import incidentsRouter from './routes/incidents'
import maintenanceRouter from './routes/maintenance'
import teamsRouter from './routes/teams'
import logsRouter from './routes/logs'
import agentsRouter from './routes/agents'
import alertRulesRouter from './routes/alertRules'
import escalationPoliciesRouter from './routes/escalationPolicies'
import { openApiSpec } from './docs/openapi'
import { startScheduler } from './jobs/scheduler'
import { globalLimiter, authStrictLimiter, refreshLimiter, noStore, blockUnsafeMethods, validateOrigin } from './middleware/security'
import { getAllowedOrigins } from './services/origins'

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET', 'JWT_REFRESH_SECRET']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

const app = express()
const port = process.env.PORT || 3000
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)
}

app.disable('etag')
app.disable('x-powered-by')

app.use(helmet({
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors({
  origin: async (origin, cb) => {
    if (!origin) return cb(null, true)
    const allowed = await getAllowedOrigins(frontendUrl)
    if (allowed.includes(origin)) return cb(null, true)
    return cb(new Error('Origin not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Agent-Token', 'Accept']
}))
app.use(validateOrigin(async () => getAllowedOrigins(frontendUrl)))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '64kb' }))

app.use(blockUnsafeMethods)

app.use('/api', globalLimiter)

app.use('/api/auth', noStore)
app.use('/api/auth/register', authStrictLimiter)
app.use('/api/auth/login', authStrictLimiter)
app.use('/api/auth/forgot-password', authStrictLimiter)
app.use('/api/auth/refresh', refreshLimiter)

app.use('/api/user', noStore)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.get('/api/system/public', async (_req, res) => {
  const [monitors, checks, incidents, agents] = await Promise.all([
    supabase.from('monitors').select('id', { count: 'exact', head: true }),
    supabase.from('checks').select('id', { count: 'exact', head: true }),
    supabase.from('incidents').select('id', { count: 'exact', head: true }).in('status', ['open', 'acknowledged', 'resolving', 'reopened']),
    supabase.from('agents').select('id', { count: 'exact', head: true })
  ])
  res.json({
    status: 'operational', monitors: monitors.count ?? 0, checks_all_time: checks.count ?? 0,
    open_incidents: incidents.count ?? 0, agents_online: agents.count ?? 0, ts: new Date().toISOString()
  })
})

app.use('/api/auth', authRouter)
app.use('/api/monitors', monitorsRouter)
app.use('/api/status-pages', statusPagesRouter)
app.use('/api/user', userRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/incidents', incidentsRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/logs', logsRouter)
app.use('/api/agents', agentsRouter)
app.use('/api/alert-rules', alertRulesRouter)
app.use('/api/escalation-policies', escalationPoliciesRouter)

app.get('/api/openapi.json', (_req, res) => res.json(openApiSpec))
app.get('/api/docs', (_req, res) => {
  res.set('Content-Type', 'text/html').send(`<!doctype html><html><head><meta charset="utf-8"><title>DronWatch API Docs</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui'})<\/script></body></html>`)
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = String(err.message || '')
  if (/cors|origin|not allowed/i.test(msg)) {
    return res.status(403).json({ error: 'Origin not allowed by CORS' })
  }
  console.error('Unhandled error', err)
  res.status(err.type === 'entity.too.large' ? 413 : (err.status || 500)).json({
    error: err.type === 'entity.too.large' ? 'Payload too large' : 'Internal server error'
  })
})

export function isWorkerOnly(): boolean {
  return process.env.WORKER_ONLY === 'true'
}

if (isWorkerOnly()) {
  if (process.env.NODE_ENV !== 'test') {
    startScheduler()
    console.log(`Worker-only mode: scheduler running, HTTP disabled`)
  }
} else {
  app.listen(port, () => {
    const region = process.env.REGION || 'self'
    console.log(`Server running on port ${port} (region: ${region})`)
    if (process.env.NODE_ENV !== 'test') {
      startScheduler()
    }
  })
}

export default app
