import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type Section = { id: string; label: string; group?: string }

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quickstart', group: 'Guides' },
  { id: 'monitors', label: 'Monitors', group: 'Guides' },
  { id: 'regions', label: 'Multi-región', group: 'Guides' },
  { id: 'alerts', label: 'Alertas & Escalations', group: 'Guides' },
  { id: 'incidents', label: 'Incidentes', group: 'Guides' },
  { id: 'status', label: 'Status Pages', group: 'Guides' },
  { id: 'analytics', label: 'Analytics & SLA', group: 'Platform' },
  { id: 'security', label: 'Security Inspector', group: 'Platform' },
  { id: 'agents', label: 'Agents & Docker', group: 'Platform' },
  { id: 'logs', label: 'Log Monitoring', group: 'Platform' },
  { id: 'synthetic', label: 'Synthetic (Playwright)', group: 'Platform' },
  { id: 'api', label: 'API & OpenAPI', group: 'Platform' },
  { id: 'anomaly', label: 'Anomaly Detection', group: 'Platform' },
  { id: 'deploy', label: 'Deploy', group: 'Ops' },
  { id: 'troubleshoot', label: 'Troubleshooting', group: 'Ops' },
  { id: 'arch', label: 'Arquitectura', group: 'Ops' },
]

function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="overflow-auto rounded-lg bg-surface-950 border border-surface-800 p-3 text-xs font-mono text-surface-300 leading-relaxed">
      <code className={lang}>{children}</code>
    </pre>
  )
}

export default function Docs() {
  useDocumentTitle('Docs · DronWatch')
  const [active, setActive] = useState('overview')

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        const vis = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (vis?.target?.id) setActive(vis.target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.2, 0.5, 1] }
    )
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-surface-950/80 border-b border-surface-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-surface-50"><span className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white text-xs">◈</span> DronWatch</Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm text-surface-300">Docs</span>
          <div className="ml-auto flex gap-2">
            <Link to="/dashboard" className="btn-ghost text-xs">Dashboard</Link>
            <a href="/api/docs" className="btn-primary text-xs">API Docs</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block sticky top-20 h-fit">
          <nav className="space-y-6">
            {Array.from(new Set(SECTIONS.map(s => s.group || ''))).map(g => (
              <div key={g || 'top'}>
                {g && <p className="text-[11px] uppercase tracking-wider text-surface-600 mb-2">{g}</p>}
                <div className="space-y-1">
                  {SECTIONS.filter(s => (s.group || '') === g).map(s => (
                    <button key={s.id} onClick={() => scrollTo(s.id)} className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${active === s.id ? 'bg-brand-500/15 text-brand-300' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900'}`}>{s.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 space-y-10">
          {/* HERO */}
          <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-brand-500/10 via-surface-900 to-surface-900 p-6 md:p-8">
            <p className="text-xs uppercase tracking-widest text-brand-400 mb-2">Monitor · Detect · Understand · Respond</p>
            <h1 className="text-3xl font-bold text-surface-50">DronWatch — observabilidad sin pagar una fortuna.</h1>
            <p className="text-surface-400 mt-3 max-w-3xl text-sm leading-relaxed">Monitoreo, alertas multi-canal, incidentes, status pages, agentes, sintéticos y API — todo gratis y self-hostable. Esta guía explica cada función con ejemplos copiables y el flujo real en la app.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => scrollTo('quickstart')} className="btn-primary text-sm">Empezar</button>
              <a href="/api/openapi.json" className="btn-ghost text-sm">OpenAPI JSON</a>
              <Link to="/auth?mode=register" className="btn-ghost text-sm">Crear cuenta</Link>
            </div>
          </div>

          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-surface-50">Overview</h2>
            <p className="text-sm text-surface-400 mt-2">5 pilares: Monitoring → Incidentes → Status → Observabilidad (Agent/Synthetic/Security). Todo corre sobre un scheduler con claim atómico, checks con timings DNS→TLS, retención con rollups ponderados y una API con scopes.</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              {[{ t: 'Monitoring', d: 'HTTP/Ping/TCP/DNS/SSL/Domain/Heartbeat/Synthetic con headers, cookies, auth, JSONPath, regex, multi-step y change detection.' }, { t: 'Alertas', d: '19 canales + reglas + escalations con delays, dedup y reintentos.' }, { t: 'Plataforma', d: 'Incidentes, status pages, agentes Docker, logs, analytics/SLA, anomalías y OpenAPI.' }].map(c => (
                <div key={c.t} className="rounded-xl border border-surface-800 bg-surface-900 p-4"><p className="font-semibold text-surface-100 text-sm">{c.t}</p><p className="text-xs text-surface-500 mt-1">{c.d}</p></div>
              ))}
            </div>
          </section>

          {/* QUICKSTART */}
          <section id="quickstart" className="scroll-mt-20 space-y-4">
            <h2 className="text-xl font-bold text-surface-50">Quickstart</h2>
            <h3 className="font-semibold text-surface-200">Local (Node 22+ + Supabase)</h3>
            <Code>{`git clone https://github.com/Fluxionics/DronWatch.git
cd DronWatch
cd backend && npm install
cd ../frontend && npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# En Supabase SQL Editor: ejecuta backend/src/db/schema.sql y cada archivo en backend/src/db/migrations/ en orden
cd backend && npm run dev    # http://localhost:3000
cd frontend && npm run dev   # http://localhost:5173`}</Code>
            <h3 className="font-semibold text-surface-200">Producción (Render + Vercel)</h3>
            <ul className="list-disc list-inside text-sm text-surface-400 space-y-1">
              <li>Render: Blueprint con <code className="font-mono text-surface-300">render.yaml</code> (root <code>backend</code>, build <code>npm ci && npm run build</code>, start <code>npm run start</code>, health <code>/api/health</code>). Env: <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_KEY</code>, <code>JWT_SECRET</code>, <code>JWT_REFRESH_SECRET</code>, <code>FRONTEND_URL</code>, <code>GMAIL_USER</code>/<code>GMAIL_APP_PASSWORD</code>.</li>
              <li>Vercel: Root <code>frontend</code>, framework Vite. Build env <code>VITE_API_URL=https://tu-api.onrender.com</code> (sin <code>/api</code>) y <code>VITE_CANONICAL_HOST=https://tu-app.vercel.app</code>.</li>
              <li>Free Render duerme a los 15 min — para monitoreo real usa instancia paga o un pinger a <code>/api/health</code> cada 2–5 min.</li>
            </ul>
            <Code lang="env">{`# backend/.env crítico
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
FRONTEND_URL=https://tu-app.vercel.app
GMAIL_USER=tu@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # app password, no tu contraseña
REGION=self
CHECK_CONCURRENCY=10`}</Code>
          </section>

          {/* MONITORS */}
          <section id="monitors" className="scroll-mt-20 space-y-4">
            <h2 className="text-xl font-bold text-surface-50">Monitores — Monitoring 2.0</h2>
            <p className="text-sm text-surface-400">Cada monitor guarda URL, nombre, tipo, intervalo (mínimo según plan), retries con backoff+jitter, circuit breaker, maintenance, parent, prioridad, región, canales y ventana de mantenimiento.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['HTTP/HTTPS', 'GET/POST/PUT/PATCH/DELETE/HEAD + headers, cookies, Basic/Bearer/API-key, body JSON/Form, GraphQL, redirects, timeout, size, compression, security-headers.'],
                ['Keyword', 'MUST contain / MUST NOT contain, regex, case, exact, strip dynamic patterns.'],
                ['Ping', 'Muestras DNS, avg/min/max/loss, alerta por alta latencia.'],
                ['TCP', 'host:port, TLS opcional, texto esperado post-connect.'],
                ['DNS', 'Tipos A/AAAA/CNAME/MX/TXT/NS/SOA/SRV, valores esperados.'],
                ['SSL/TLS', 'Días a expiración, issuer/SAN, TLS version, cipher, chain.'],
                ['Domain', 'RDAP/WHOIS expiry, registrar, nameservers.'],
                ['Heartbeat', 'Tu cron hace POST /heartbeat; si no llega en grace → DOWN.'],
                ['Synthetic', 'Flujo Playwright: goto → click → fill → wait → assert, con timing por step.'],
              ].map(([t, d]) => <div key={t} className="rounded-lg border border-surface-800 bg-surface-900 p-3"><p className="font-medium text-surface-200 text-sm">{t}</p><p className="text-xs text-surface-500 mt-1">{d}</p></div>)}
            </div>
            <h3 className="font-semibold text-surface-200">HTTP avanzado</h3>
            <ul className="list-disc list-inside text-sm text-surface-400 space-y-1">
              <li><code>accepted_codes</code>, <code>expect_content_type</code>, <code>check_security_headers</code>, <code>check_compression</code>, <code>max_response_size</code>, <code>max_redirects</code>, <code>allow_invalid_certs</code>.</li>
              <li>JSON: <code>jsonpath</code> + <code>jsonpath_expected</code>, <code>json_compare</code> (subset), <code>ignore_patterns</code> para strip dinámico y <code>change_detection</code> (hash SHA256).</li>
              <li>Multi-step API flows sin browser: steps con method/url/expected_status/expect_content/extract <code>{'{{'}var{'}}'}</code>.</li>
              <li>Timings por check: DNS, TCP, TLS, TTFB, total (corregidos: TLS = secureConnect − connect).</li>
            </ul>
            <Code>{`# Body con vars (Settings → Environment variables)
{"email":"{{user_email}}"}
# Header
X-API-Key: {{api_key}}`}</Code>
          </section>

          {/* REGIONS */}
          <section id="regions" className="scroll-mt-20 space-y-4">
            <h2 className="text-xl font-bold text-surface-50">Multi-región REAL</h2>
            <p className="text-sm text-surface-400">Selecciona probes en MonitorForm (<code>mx</code>, <code>us-east</code>, <code>us-west</code>, <code>br</code>, <code>de</code>, <code>sg</code>, <code>au</code>, <code>jp</code>...). Modo quorum:</p>
            <ul className="list-disc list-inside text-sm text-surface-400"><li><code>quorum</code> (default): mayoría arriba → UP</li><li><code>all</code>: todas arriba → UP</li><li><code>any</code>: al menos una arriba → UP</li></ul>
            <Code>{`Single host (REGION=self) → replica el mismo probe N regiones para poblar historia.
Workers distribuidos (REGION=mx/us-east/de + WORKER_ONLY=true) → cada worker solo atiende sus regiones, el quorum se evalúa leyendo los últimos checks por región.`}</Code>
            <p className="text-sm text-surface-400">Outage type se anota en alertas: <code>[GLOBAL OUTAGE]</code> (todas) vs <code>[REGIONAL OUTAGE]</code> (parcial). Panel por región en MonitorDetail con <code>uptime_24h</code> y latencia.</p>
          </section>

          {/* ALERTS */}
          <section id="alerts" className="scroll-mt-20 space-y-4">
            <h2 className="text-xl font-bold text-surface-50">Alertas inteligentes & Escalations</h2>
            <p className="text-sm text-surface-400">Canales (19): email, slack, discord, webhook, telegram, teams, google_chat, pushover, gotify, mattermost, matrix, pagerduty, opsgenie, twilio_sms, jira, linear, github_issue, gitlab_issue, webpush.</p>
            <p className="text-sm text-surface-400"><b>Reglas</b> (Alerts → Alert rules): <code>down_for</code>, <code>latency_above</code>, <code>ssl_expires_within</code>, <code>status_code</code>, <code>keyword</code>, <code>response_size_above</code>, <code>error_rate_above</code> con <code>threshold</code> + <code>for_minutes</code>, dedup por <code>last_fired_at/last_ok_at</code>.</p>
            <p className="text-sm text-surface-400"><b>Escalations</b>: políticas con steps <code>[delay_minutes, channels[]]</code>. Monitor con <code>escalation_policy_id</code> dispara step 0 al caer y los siguientes cada <code>delay</code> mientras siga DOWN; se cancela al recuperarse.</p>
            <Code>{`# Probar canal sin esperar caída
POST /api/alerts/test
{ "monitor_id": "uuid", "type": "email", "recipient": "you@example.com" }
# → alerta [TEST] y fila en historial con is_sent`}</Code>
            <p className="text-sm text-surface-400">Delivery con estados <code>pending/sending/sent/failed</code>, <code>attempts</code>, <code>next_retry_at</code> y reintento cada minuto con backoff exponencial (hasta 5 intentos). Usa <b>Send test</b> en Alerts para verificar.</p>
            <p className="text-xs text-surface-500">Tip: <b>Test now</b> en el monitor hace un check real y, si cambió el estado, manda alertas reales.</p>
          </section>

          {/* INCIDENTS */}
          <section id="incidents" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Incidentes</h2>
            <p className="text-sm text-surface-400">Se abren al caer y se resuelven al recuperarse. Flujo <code>open → acknowledged → resolving → resolved</code> (+ closed/reopened). Añade updates públicas/internas, tasks, assignee/tags y postmortem. Timeline automático. Revisa autorización por <code>user_id</code> en cada write.</p>
          </section>

          {/* STATUS */}
          <section id="status" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Status Pages PRO</h2>
            <ul className="list-disc list-inside text-sm text-surface-400 space-y-1">
              <li>Visibilidad: public / private / password (<code>?password=</code>).</li>
              <li>Grupos, logo, colores, toggle “Powered by”, suscripciones double opt-in (token 7d, single-use), RSS <code>/api/status-pages/feed/:slug</code>, webhooks, mantenimiento e historial de incidentes.</li>
              <li>Custom domain: <code>custom_domain</code> + DNS CNAME + <code>VITE_CANONICAL_HOST</code> para host-mode. Público en <code>/status/:slug</code> y el estado por región si el monitor es multi-región.</li>
            </ul>
          </section>

          {/* ANALYTICS */}
          <section id="analytics" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Analytics & SLA</h2>
            <p className="text-sm text-surface-400">Ventanas: <code>1h</code>/<code>24h</code>/<code>7d</code>/<code>30d</code>/<code>90d</code>/<code>180d</code>/<code>365d</code>/<code>all</code>. Métricas: uptime, downtime, availability, MTTR/MTTA/MTBF, error/success rate, p50/p75/p90/p95/p99/p99.9, min/max/avg, DNS/TCP/TLS/TTFB, response size.</p>
            <p className="text-sm text-surface-400"><b>SLA calculator</b> por ventana: elegible <code>sla_target</code> (99–99.99%) en el monitor; la tabla muestra <i>allowed downtime</i> vs <i>actual</i> y <code>PASS/BREACH</code>. Error budget = <code>SLA − uptime</code>.</p>
          </section>

          {/* SECURITY */}
          <section id="security" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Security Inspector</h2>
            <p className="text-sm text-surface-400">Actívalo con <code>security_inspector</code> en el monitor. Cada check https captura TLS version/cipher/chain y headers, calcula <b>score A+–F</b> con: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer/Permissions-Policy, TLS 1.2/1.3, cipher fuerte, expiry &gt;30d y chain ≥2. Panel en MonitorDetail + <code>GET /monitors/:id/security</code>.</p>
          </section>

          {/* AGENTS */}
          <section id="agents" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Agents & Docker</h2>
            <Code>{`# En el servidor a vigilar (Node 16+)
export DW_AGENT_TOKEN=ag_xxx   # token mostrado una vez al crear el agent
export AGENT_API_URL=https://tu-api.onrender.com
export DW_INTERVAL=30
export DW_SERVICES="nginx:80,postgres:5432,redis:6379"  # opcional
node -e "$(curl -fsSL https://tu-api.onrender.com/api/agents/<id>/script?token=...)" 
# o descarga el script desde Observability → Agents → View script`}</Code>
            <p className="text-sm text-surface-400">Reporta CPU/mem/disk/load/processes/network, <code>uptime</code>, <code>temperature</code> (thermal_zone), <code>services</code> (probe 127.0.0.1:port) y <code>docker</code> vía <code>/var/run/docker.sock</code>. Heartbeat history y tabla <code>heartbeat_runs</code>.</p>
          </section>

          {/* LOGS */}
          <section id="logs" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Log Monitoring</h2>
            <Code>{`POST /api/logs/ingest?api_key=dw_xxx
[{"service":"app","level":"error","message":"OutOfMemoryError: heap","tags":["db"]}]
# Buscar
GET /api/logs/search?q=OutOfMemory&level=error&limit=100`}</Code>
            <p className="text-sm text-surface-400">Ingesta por API key o <code>user_id</code>, búsqueda por <code>q/level/service/monitor_id</code>, niveles. Activa <code>log_alert_pattern</code> en el monitor (ej. <code>OutOfMemoryError</code>) y el scheduler crea alerta <code>webhook</code> si aparece en el último minuto. Observability tiene <b>Live tail</b> (poll cada 2s).</p>
          </section>

          {/* SYNTHETIC */}
          <section id="synthetic" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Synthetic — Browser flows</h2>
            <p className="text-sm text-surface-400">Tipo <code>synthetic</code> con <code>synthetic_steps</code> Playwright: <code>goto</code>, <code>click</code>, <code>fill</code>, <code>waitFor</code>, <code>assert</code>. Requiere <code>npm i playwright && npx playwright install chromium</code> en el worker; si falta, el check reporta error controlado. Se guarda per-step timing en <code>extra.syntheticSteps</code> y se muestra en MonitorDetail.</p>
            <Code>{`{
  "type": "synthetic",
  "url": "https://example.com",
  "config": {
    "synthetic_steps": [
      {"action":"goto","url":"https://example.com/login"},
      {"action":"fill","selector":"input[name=email]","value":"test@example.com"},
      {"action":"fill","selector":"input[name=password]","value":"secret"},
      {"action":"click","selector":"button[type=submit]"},
      {"action":"waitFor","selector":".dashboard"},
      {"action":"assert","selector":"h1","contains":"Welcome"}
    ],
    "synthetic_timeout": 30000
  }
}`}</Code>
          </section>

          {/* API */}
          <section id="api" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">API & OpenAPI</h2>
            <p className="text-sm text-surface-400">REST en <code>/api</code> con JWT, <code>X-API-Key</code> con scopes <code>resource:read/write</code> (ej. <code>monitors:read</code>) y <code>X-Agent-Token</code> solo para heartbeat. <a href="/api/openapi.json" className="text-brand-400 underline">OpenAPI JSON</a> y <a href="/api/docs" className="text-brand-400 underline">Swagger UI</a> en <code>/api/docs</code>.</p>
            <Code>{`curl -H "Authorization: Bearer <jwt>" https://tu-api.onrender.com/api/monitors
curl -H "X-API-Key: dw_xxx" https://tu-api.onrender.com/api/status-pages
curl -H "X-Agent-Token: ag_xxx" -X POST https://tu-api.onrender.com/api/agents/<id>/heartbeat -d '{"stats":{}}'`}</Code>
            <p className="text-xs text-surface-500">Scopes: vacío = acceso total (legacy); con scopes se valida <code>resource:action</code> derivado de la ruta y método. Crea keys con scopes en Settings → API Keys o <code>POST /api/user/api-keys</code>.</p>
          </section>

          {/* ANOMALY */}
          <section id="anomaly" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Anomaly Detection</h2>
            <p className="text-sm text-surface-400">Baseline de 50 muestras exitosas: si <code>responseTime &gt; avg+3σ</code> o <code>&gt;2.5× avg +300ms</code>, el check se marca <code>extra.anomaly</code> con <code>anomalyReason</code>. Panel en MonitorDetail + <code>GET /monitors/:id/anomalies</code>. No bloquea alertas, solo señala.</p>
          </section>

          {/* DEPLOY */}
          <section id="deploy" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Deploy & Ops</h2>
            <ul className="list-disc list-inside text-sm text-surface-400 space-y-1">
              <li><b>Self-host</b>: cualquier VM con Node 22 + Postgres/Supabase. Scheduler con claim atómico (N workers sin duplicados), 10 checks concurrentes y circuit breaker.</li>
              <li><b>Retención</b>: raw 7d → hourly 90d → daily 730d (ponderado sum/count), configurable.</li>
              <li><b>Env</b>: ver <code>backend/.env.example</code> y <code>frontend/.env.example</code> para todas las vars (GMAIL, TWILIO, REGION, WORKER_ONLY, etc.).</li>
              <li><b>Migraciones</b>: corre en orden cada <code>backend/src/db/migrations/*.sql</code> en Supabase SQL Editor.</li>
            </ul>
          </section>

          {/* TROUBLESHOOT */}
          <section id="troubleshoot" className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold text-surface-50">Troubleshooting</h2>
            <ul className="list-disc list-inside text-sm text-surface-400 space-y-1">
              <li><b>No llegan correos</b>: <code>GMAIL_APP_PASSWORD</code> debe ser app password de 16 chars (2FA), no tu contraseña. Revisa logs <code>Failed to send</code>. Las alertas solo salen en cambio de estado — usa <b>Send test</b>.</li>
              <li><b>App “not found” / 404s</b>: <code>VITE_API_URL</code> en Vercel debe ser exactamente <code>https://tu-api.onrender.com</code> (con https, sin /api). Redeploy + hard refresh.</li>
              <li><b>CORS</b>: <code>FRONTEND_URL</code> en Render debe ser tu URL exacta de Vercel.</li>
              <li><b>Backend duerme (Render free)</b>: pinger a <code>/api/health</code> cada 2–5 min o usa instancia paga.</li>
              <li><b>Synthetic falla “Playwright not installed”</b>: instala en el worker <code>npm i playwright && npx playwright install chromium --with-deps</code>.</li>
            </ul>
          </section>

          {/* ARCH */}
          <section id="arch" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-surface-50">Arquitectura</h2>
            <div className="rounded-lg bg-surface-950 border border-surface-800 p-4 font-mono text-xs text-surface-400 leading-relaxed">
              Browser (Vite) ──HTTPS──▶ API (Express + cron) ──▶ Supabase (Postgres)<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br />
              Agents ──heartbeat (X-Agent-Token) ──┘<br />
              Scheduler: claim atómico (last_check), 10 concurrent, circuit breaker, rollups, retries, escalations
            </div>
            <p className="text-xs text-surface-600 mt-3">Solo <code>main</code> tiene soporte. Reporta vulnerabilidades como advisory privado en GitHub (ver <Link to="/api/docs" className="text-brand-400">SECURITY.md</Link>).</p>
          </section>

          <div className="pt-6 border-t border-surface-800 flex flex-wrap gap-2">
            <Link to="/" className="btn-ghost text-sm">← Landing</Link>
            <a href="https://github.com/Fluxionics/DronWatch" target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">View on GitHub</a>
            <Link to="/dashboard" className="btn-primary text-sm ml-auto">Ir al Dashboard</Link>
          </div>
        </main>
      </div>
    </div>
  )
}
