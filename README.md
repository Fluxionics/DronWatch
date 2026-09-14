# DronWatch

Free, open-source uptime monitoring and status pages. Monitors, alert rules, incidents,
status pages, agents and a REST API — self-hostable in minutes.

## Features

- **Monitors**: HTTP(S), keyword, ping, TCP, DNS, SSL, domain expiry and heartbeat checks,
  with per-stage timings (DNS → TCP → TLS → TTFB → total), retries with exponential
  backoff, circuit breaker, maintenance windows, priorities and region labels.
- **Alerts**: 19 channels (email, Slack, Discord, webhook, Telegram, Teams, Google Chat,
  Pushover, Gotify, Mattermost, Matrix, PagerDuty, Opsgenie, Twilio SMS, Jira, Linear,
  GitHub/GitLab issues, web push), alert rules (`down_for`, `latency_above`,
  `ssl_expires_within`), one-click channel testing, delivery states and automatic retries.
- **Incidents**: open → acknowledged → resolving → resolved lifecycle, public/internal
  updates, tasks and postmortems.
- **Status pages**: public, private or password-protected, custom domains, groups,
  email subscriptions with double opt-in, RSS feed, incident and maintenance display.
- **Agents**: lightweight Node script reporting CPU, memory, disk, load, processes and
  network; heartbeat history per agent.
- **Plans & limits**: free/pro/business/enterprise tiers with monitor, interval,
  status-page, agent and history limits enforced by the API.
- **Retention**: raw checks roll up into hourly then daily aggregates (weighted averages),
  with per-plan history windows.
- **API**: REST API with JWT sessions, API keys with granular scopes, and agent tokens
  restricted to agent endpoints.

## Architecture

```
Browser (Vite SPA) ──HTTPS──> API (Express + node-cron) ──> Supabase (PostgreSQL)
                                    │                              ▲
Agents (Node script) ──heartbeat─── │                              │
                                                checks/alerts/incidents/status data
```

The API process also runs the scheduler (checks, reports, alert retries, retention
rollups). For multi-instance setups, checks are claimed atomically in the database so
two workers never run the same check.

## Quickstart (local)

Requirements: Node.js 22+, a Supabase project.

```bash
git clone https://github.com/Fluxionics/DronWatch.git
cd DronWatch
cd backend && npm install
cd ../frontend && npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

1. In Supabase → SQL Editor, run `backend/src/db/schema.sql`, then every file in
   `backend/src/db/migrations/` in filename order.
2. Fill in `backend/.env` (see reference below) and `frontend/.env`
   (`VITE_API_URL=http://localhost:3000`).
3. Run:

```bash
cd backend && npm run dev    # http://localhost:3000
cd frontend && npm run dev   # http://localhost:5173
```

## Production deploy (Render + Vercel)

- **Backend → Render**: New → Blueprint using `render.yaml` (root `backend`,
  build `npm ci && npm run build`, start `npm run start`, health `/api/health`),
  or a manual Web Service with the same commands. Set the backend env vars below.
  Note: Render's free tier sleeps after 15 idle minutes — for real monitoring either
  use a paid instance or keep it awake by pinging `/api/health` every few minutes
  (e.g. cron-job.org or UptimeRobot free).
- **Frontend → Vercel**: import the repo with Root Directory `frontend`
  (framework: Vite). Build env: `VITE_API_URL=https://<your-api>.onrender.com`
  (no trailing `/api`) and optionally `VITE_CANONICAL_HOST=https://<your-app>.vercel.app`.
- **CI (optional)**: GitHub Actions deploys the backend to Render via deploy hook
  (`RENDER_DEPLOY_HOOK` secret) and the frontend to Vercel
  (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VITE_API_URL` secrets).

### Backend env reference

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | yes | Service-role key (server only, never expose) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | yes | Long random strings (`openssl rand -hex 64`) |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | no | Defaults `15m` / `7d` |
| `FRONTEND_URL` | yes | Public frontend URL (CORS + email links) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | for email | Gmail address + 16-char app password (not your login password) |
| `NODE_ENV` | no | `production` in prod |
| `TRUST_PROXY` | behind proxy | e.g. `1`, so rate limits see real IPs |
| `REGION` | no | Region label for checks (default `self`) |
| `WORKER_ONLY` | no | `true` runs scheduler without HTTP (extra workers) |
| `CHECK_RETENTION_DAYS` / `HOURLY_RETENTION_DAYS` / `DAILY_RETENTION_DAYS` | no | Defaults `7` / `90` / `730` |
| `CHECK_CONCURRENCY` | no | Max parallel checks (default `10`) |
| `CIRCUIT_BREAKER_FAILURES` / `CIRCUIT_BREAKER_COOLDOWN_MS` | no | Defaults `5` / `300000` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | for SMS | Twilio credentials |

### Frontend env reference

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | yes | Backend base URL, **without** `/api` |
| `VITE_CANONICAL_HOST` | no | Frontend host for custom-domain status pages |

## Usage

Full step-by-step guide: [docs/USAGE.md](docs/USAGE.md) — monitors, all 19 alert
channel formats, alert rules, incidents, status pages, agents, API keys and scopes,
reports, troubleshooting.

## Security & policies

- [SECURITY.md](SECURITY.md) — vulnerability reporting, secrets handling, defenses.
- [PRIVACY.md](PRIVACY.md) — what data is stored, retention, your rights.
- Never commit `.env` files or paste tokens/keys into issues, PRs or chats. If a
  secret leaks, rotate it immediately.

## License

MIT
