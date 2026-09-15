# DronWatch

Free and open-source uptime monitoring with status pages, alerts, incidents, agents, and a REST API.

DronWatch is designed as a self-hostable alternative to traditional uptime monitoring platforms. It provides website and service monitoring, configurable alerts, incident management, public status pages, infrastructure agents, and API access from a single platform.

---

## Features

### Monitors

DronWatch supports multiple monitoring methods:

* HTTP / HTTPS
* Keyword monitoring
* Ping
* TCP
* DNS
* SSL certificate monitoring
* Domain expiration monitoring
* Heartbeat monitoring

Each check can provide detailed timing information:

```text
DNS → TCP → TLS → TTFB → Total
```

Monitoring also includes:

* Exponential-backoff retries
* Circuit breakers
* Maintenance windows
* Monitor priorities
* Region labels
* Check history
* Availability and latency tracking

---

## Alerts

DronWatch supports multiple notification channels so you can choose where monitoring events should be delivered.

### Supported channels

* Email
* Slack
* Discord
* Webhooks
* Telegram
* Microsoft Teams
* Google Chat
* Pushover
* Gotify
* Mattermost
* Matrix
* PagerDuty
* Opsgenie
* Twilio SMS
* Jira
* Linear
* GitHub Issues
* GitLab Issues
* Web Push

Alert rules currently include:

```text
down_for
latency_above
ssl_expires_within
```

Alerts also support:

* Channel testing
* Delivery states
* Automatic retries
* Delivery tracking

---

## Incidents

DronWatch includes a complete incident lifecycle:

```text
OPEN
  ↓
ACKNOWLEDGED
  ↓
RESOLVING
  ↓
RESOLVED
```

Incidents can include:

* Public updates
* Internal updates
* Incident tasks
* Postmortems
* Resolution tracking

This allows teams to keep a clear history of what happened and how an issue was handled.

---

## Status Pages

Create public or private status pages for your services.

Supported options include:

* Public status pages
* Private status pages
* Password-protected pages
* Custom domains
* Email subscriptions
* Double opt-in subscriptions
* RSS feeds
* Incident display
* Maintenance display

Status pages can be used to communicate service availability without exposing the internal monitoring dashboard.

---

## Agents

DronWatch also supports lightweight monitoring agents.

The agent can report system information such as:

* CPU usage
* Memory usage
* Disk usage
* System load
* Processes
* Network information

Agents send heartbeat data back to the DronWatch API, allowing infrastructure health to be monitored alongside external services.

---

## Plans and Limits

DronWatch includes plan-based limits enforced by the API.

Available plan levels:

| Plan       | Purpose                          |
| ---------- | -------------------------------- |
| Free       | Basic monitoring                 |
| Pro        | Extended monitoring capabilities |
| Business   | Larger monitoring environments   |
| Enterprise | Advanced deployments             |

Limits can apply to:

* Number of monitors
* Monitoring intervals
* Status pages
* Agents
* Historical data

The API is responsible for enforcing these limits.

---

## Data Retention

DronWatch uses a retention and aggregation system to avoid keeping every raw check indefinitely.

Monitoring data can be rolled up into:

```text
Raw checks
    ↓
Hourly aggregates
    ↓
Daily aggregates
```

Historical retention depends on the configured plan limits.

Aggregated data can use weighted averages to preserve meaningful monitoring statistics while reducing long-term storage requirements.

---

## REST API

DronWatch provides a REST API for interacting with the monitoring platform.

Authentication supports:

* JWT sessions
* Scoped API keys
* Agent tokens

Agent tokens are restricted to agent-related endpoints.

The API can be used by external applications, scripts, integrations, and automation systems.

---

# Architecture

DronWatch is structured around a frontend, API, database, and monitoring workers.

```text
┌──────────────────────────┐
│        Vite SPA          │
│       Frontend            │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Express API          │
│      + node-cron         │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Supabase PostgreSQL    │
└──────────────────────────┘

             ▲
             │
┌────────────┴─────────────┐
│        Agents            │
│      Heartbeats          │
└──────────────────────────┘
```

The scheduler is responsible for monitoring jobs, reports, retries, and retention tasks.

For multi-instance deployments, database-level atomic claiming is used to prevent the same monitoring job from being processed multiple times.

---

# Tech Stack

## Frontend

* Vite
* SPA architecture

## Backend

* Node.js
* Express
* node-cron

## Database

* Supabase
* PostgreSQL

## Deployment

* Vercel
* Render
* GitHub Actions

---

# Requirements

Before installing DronWatch, make sure you have:

* Node.js 22+
* A Supabase project
* Git
* A GitHub account if you plan to use GitHub Actions

---

# Quick Start

Clone the repository:

```bash
git clone https://github.com/Fluxionics/DronWatch.git
cd DronWatch
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

---

## Database Setup

Create a Supabase project and configure the database.

Run the main schema:

```text
schema.sql
```

Then apply the available migrations.

---

## Environment Variables

### Backend

Configure the required backend environment variables:

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

JWT_SECRET=
JWT_REFRESH_SECRET=

FRONTEND_URL=

NODE_ENV=
TRUST_PROXY=

REGION=
WORKER_ONLY=

RETENTION_DAYS=
CONCURRENCY=

CIRCUIT_BREAKER_FAILURE_THRESHOLD=
CIRCUIT_BREAKER_RESET_MS=

GMAIL_USER=
GMAIL_APP_PASSWORD=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
```

Only configure the notification provider credentials that your deployment actually uses.

---

### Frontend

Create the frontend environment configuration:

```env
VITE_API_URL=
VITE_CANONICAL_HOST=
```

---

# Running Locally

Start the backend:

```bash
cd backend
npm run dev
```

The API runs on:

```text
http://localhost:3000
```

Start the frontend:

```bash
cd frontend
npm run dev
```

The Vite development server runs on:

```text
http://localhost:5173
```

---

# Production Deployment

## Backend — Render

The backend includes a `render.yaml` configuration.

The deployment uses the backend directory as the root.

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start
```

Health endpoint:

```text
/api/health
```

---

## Frontend — Vercel

Deploy the `frontend` directory as a Vite application.

Configure:

```env
VITE_API_URL=
VITE_CANONICAL_HOST=
```

The frontend communicates with the deployed DronWatch API.

---

## GitHub Actions

GitHub Actions can also be used for deployment through deployment hooks.

This allows deployments to be triggered automatically as part of a repository workflow.

---

# Documentation

More detailed usage information is available in:

```text
docs/USAGE.md
```

The documentation covers:

* Creating monitors
* Monitor configuration
* Alert channels
* Alert rules
* Incidents
* Status pages
* Agents
* API keys
* API scopes
* Reports
* Troubleshooting

---

# Security

Security is an important part of the project.

DronWatch includes protections such as:

* JWT-based authentication
* Scoped API keys
* Restricted agent tokens
* Environment-based secrets
* Database-level job claiming
* Monitoring retry controls
* Circuit breakers
* Plan-based API limits

Never commit secrets or production credentials to the repository.

Keep environment variables outside the source code.

---

# Project Structure

A simplified structure looks like this:

```text
DronWatch/
│
├── backend/
│   ├── ...
│   └── package.json
│
├── frontend/
│   ├── ...
│   └── package.json
│
├── docs/
│   └── USAGE.md
│
├── schema.sql
├── render.yaml
├── SECURITY.md
├── PRIVACY.md
└── README.md
```

---

# Monitoring Flow

A typical monitoring cycle looks like this:

```text
Monitor
   ↓
Scheduler
   ↓
Check
   ↓
Retry if necessary
   ↓
Circuit breaker evaluation
   ↓
Result
   ↓
Store check data
   ↓
Evaluate alert rules
   ↓
Send notifications
```

For incidents:

```text
Service failure
      ↓
Alert rule triggered
      ↓
Incident opened
      ↓
Notification sent
      ↓
Incident acknowledged
      ↓
Service recovery
      ↓
Incident resolved
```

---

# Why DronWatch?

DronWatch is built around a simple idea:

```text
Monitor your services.
Know when something breaks.
Understand what happened.
Let your users know.
```

The goal is to keep uptime monitoring accessible while providing the infrastructure needed for more advanced deployments.

It can be self-hosted, extended through the REST API, and integrated with external notification and development tools.

---

# License

DronWatch is released under the MIT License.

See:

```text
LICENSE
```

for the complete license text.

---

# Contributing

Contributions, bug reports, improvements, and ideas are welcome.

Before opening a pull request:

1. Make sure the project builds correctly.
2. Test the affected functionality.
3. Keep changes focused.
4. Update the documentation when necessary.
5. Avoid committing secrets or environment files.

---

<div align="center">

### DronWatch

Open-source uptime monitoring built for people who want control over their monitoring stack.

**Monitor. Detect. Respond.**

</div>
