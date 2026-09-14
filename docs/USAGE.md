# DronWatch User Guide

## 1. Account

- **Sign up** with username + password (8+ chars, letter + number). Email is optional
  and only used for password recovery.
- **Sign in** at `/auth`. Forgot your password? Use “Forgot password?” — you get a
  link valid for 1 hour.
- Sessions expire; the app refreshes them automatically. Change your password or
  delete your account in **Settings**.

## 2. Monitors

**Dashboard → New monitor.** Common fields: name, URL, type, check interval
(minimum depends on your plan), retries, priority, region label, notification
channels, maintenance windows.

Monitor types:

| Type | What it does | Key settings |
| --- | --- | --- |
| HTTP | GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS with headers, cookies, Basic/Bearer/API-key auth, body, GraphQL, timeout, redirects, expected status codes | `accepted_codes`, `keyword`, `regex`, `jsonpath`, content checks, security-headers check |
| Keyword | HTTP + requires/forbids a keyword in the body | `keyword`, match mode, case sensitivity |
| Ping | Host reachability probe (DNS + samples, avg/min/max/loss) | `samples`, `high_latency_ms` |
| TCP | Opens host:port, optional TLS and expected text | `port`, `tls`, `expect_text` |
| DNS | Requires a DNS record type/value | record type, expected values |
| SSL | Certificate validity, expiry days, issuer/SAN | `days_threshold`, `allow_self_signed` |
| Domain | Domain expiry via RDAP | `hostname` |
| Heartbeat | Expects regular pings from your own job (cron, CI) | schedule + grace period; missed heartbeat = DOWN |

Extra behavior:

- **Retries**: on failure the engine retries with exponential backoff + jitter before
  marking DOWN.
- **Confirmation**: with multiple `regions` configured, a DOWN is double-checked
  before alerting (avoids single-probe false alarms).
- **Circuit breaker**: after repeated check *errors*, checks pause briefly instead of
  hammering a dead endpoint.
- **Maintenance**: silence alerts during windows; checks are recorded as maintenance.
- **Test now** runs a real check immediately (note: if the status changed, it sends
  real alerts).
- **Monitor detail** shows uptime charts, response-time charts, per-stage timings,
  per-region status, downtime events, the service report (MTTA/MTTR/error budget),
  recent checks and CSV/JSON export.

## 3. Notification channels

Add channels per monitor (Monitors → Edit → Notifications). Exact `target` format
per type:

| Channel | Target format | Notes |
| --- | --- | --- |
| Email | `you@example.com` | Needs `GMAIL_USER` + `GMAIL_APP_PASSWORD` on the server |
| Slack | `https://hooks.slack.com/services/...` | Incoming webhook URL |
| Discord | `https://discord.com/api/webhooks/...` | Webhook URL |
| Webhook | `https://your-server.com/hook` | POSTs `{event, monitor_id, message, timestamp}` |
| Telegram | `BOT_TOKEN\|CHAT_ID` | Bot token + chat id |
| Teams | `https://outlook.office.com/webhook/...` | Workflow webhook URL |
| Google Chat | `https://chat.googleapis.com/v1/spaces/...` | Webhook URL |
| Pushover | `USER_KEY\|APP_TOKEN` | |
| Gotify | `https://gotify.example.com\|APP_TOKEN` | |
| Mattermost | `https://mattermost.example.com/hooks/...` | Webhook URL |
| Matrix | Homeserver webhook URL | POSTs `{text}` |
| PagerDuty | `ROUTING_KEY` | Events API v2 |
| Opsgenie | `API_KEY\|ALIAS(optional)` | |
| SMS (Twilio) | `+15551234567` | Needs `TWILIO_*` on the server |
| Jira | `TOKEN\|BASE_URL\|PROJECT_KEY` | Creates a Bug issue |
| Linear | `API_KEY\|TEAM_ID\|ASSIGNEE_ID(optional)` | |
| GitHub Issue | `TOKEN\|OWNER/REPO` | |
| GitLab Issue | `TOKEN\|GROUP/PROJECT` | |
| Web push | `https://your-push-server/webhook` | POSTs `{text}` |

Alerts fire on status **changes** (UP→DOWN, DOWN→UP); while still down you can set
`repeat_minutes` for reminders. Every attempt is recorded in **Alerts → History**
with `sent` / `queued` / `failed` state, and failed ones retry automatically with
backoff (up to 5 attempts).

## 4. Alert rules

**Alerts → Alert rules.** Rules evaluate on every check, per monitor:

- `Down for`: fire after N consecutive minutes down.
- `Latency above`: fire when response time exceeds N ms for the configured window.
- `SSL expires within`: fire when the certificate renews within N days.

Each rule has its own channels and on/off switch. A rule fires once until the
condition clears (`last_fired_at` / `last_ok_at` dedup).

## 5. Test a channel

**Alerts → Test a channel**: pick a monitor, a channel type and a recipient, then
“Send test”. The message is marked `[TEST]` and also appears in history — use it to
verify email, Discord, Slack, etc. work before a real outage.

## 6. Incidents

Down transitions open incidents automatically; you can also create them manually.
Lifecycle: `open → acknowledged → resolving → resolved` (plus `closed`/`reopened`).
Add public updates (shown on status pages) or internal notes, track tasks, and write
a postmortem (root cause, timeline, actions).

## 7. Status pages

**Status pages → New**: name, slug, monitors (optionally grouped), visibility:

- **Public**: anyone with the link (or custom domain) can see it.
- **Private**: only you.
- **Password**: visitors append `?password=...`.

Features: custom logo/background colors, “Powered by” toggle, maintenance banners,
incident history, uptime bars, RSS feed (`/api/status-pages/feed/<slug>`),
subscriber emails with double opt-in (7-day expiring tokens, one-click unsubscribe).

**Custom domain**: set `custom_domain` (e.g. `status.example.com`), point its DNS
(CNAME/A) at your frontend host, and set the frontend env `VITE_CANONICAL_HOST` to
your frontend host so unknown hosts render the matching status page.

## 8. Maintenance windows

**Maintenance**: define title, monitors and time range. Checks during the window are
recorded without alerting, and active windows show as banners on status pages.

## 9. Agents

**Observability → Agents → New** gives you a token (shown once) and an install
script. On the server to monitor:

```bash
export DW_AGENT_TOKEN=<token>
export AGENT_API_URL=https://<your-api>   # default: the app itself
export DW_INTERVAL=30                      # seconds between reports
node agent.js
```

Agents report CPU, memory, disk, load, processes and network every interval, visible
in Observability with history. Heartbeat runs (duration/exit code) are recorded when
the agent sends them.

## 10. API keys & scopes

**Settings → API keys**: create keys (`dw_...`, shown once). Optional **scopes**
limit what the key can do, e.g. `monitors:read`, `monitors:write`,
`status_pages:read`, `incidents:write`. A key with no scopes keeps full access
(legacy behavior). Use the `X-API-Key` header (works without a Bearer token).
Agent tokens (`X-Agent-Token`) only work on agent heartbeat endpoints.

## 11. Reports & settings

- **Settings → Scheduled reports**: daily/weekly/monthly HTML email with uptime,
  latency, MTTA/MTTR and error budget per monitor.
- **Settings → Environment variables**: reusable `{{secrets}}` for monitor configs.
- **Settings → Plan**: switch tiers; limits (monitors, min interval, status pages,
  agents, history) are enforced by the API with clear 402 messages.

## 12. Troubleshooting

- **App shows “not found” / console 404s**: `VITE_API_URL` in Vercel must be exactly
  `https://<your-api>.onrender.com` — with `https:`, no trailing `/api`, no typos.
  Redeploy after changing it and hard-refresh (`Ctrl+F5`).
- **`.../api/api/...` URLs**: old frontend bundle or `VITE_API_URL` ending in
  `/api` on an old build — redeploy the latest frontend.
- **CORS errors**: `FRONTEND_URL` on the backend must equal your exact frontend URL.
- **No emails**: `GMAIL_APP_PASSWORD` must be a 16-char **app password** (Google
  account → 2-step verification → App passwords), not your login password. Check
  backend logs for `Failed to send`. Remember alerts only fire on status changes —
  use **Send test** to verify.
- **Backend sleeps (Render free)**: checks stop while asleep. Ping
  `/api/health` every few minutes or use a paid instance.
- **Status page “not found or private”**: the slug must exist and the page must be
  public (or use `?password=`); verify the API directly:
  `<api>/api/status-pages/public/<slug>`.
