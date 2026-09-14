# DronWatch

Free, open-source uptime monitoring. The premium features other tools charge for — unlimited
monitors, 1-minute checks, public status pages, Slack/Discord alerts, and a REST API — are free.

## Features

- Unlimited monitors & status pages, free forever
- Checks as frequent as every minute
- Uptime percentage and response-time charts (7 / 30 / 90 days)
- Downtime event history
- Alerts via email, Slack, Discord, and custom webhooks
- Public status pages with custom branding
- REST API with per-user API keys
- Anonymous sign-up (username + password)

## Tech stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express + TypeScript, background scheduler (node-cron)
- **Database:** Supabase (PostgreSQL)

## Getting started

1. Clone the repo and install dependencies:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Create your environment files from the examples:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Fill in `backend/.env` — you need a Supabase project with the schema from
   `backend/src/db/schema.sql` applied:

   | Variable               | Description                                      |
   | ---------------------- | ------------------------------------------------ |
   | `SUPABASE_URL`         | Your Supabase project URL                        |
   | `SUPABASE_SERVICE_KEY` | Service-role key (server-side only — never expose it) |
   | `JWT_SECRET`           | Long random string for access tokens             |
   | `JWT_REFRESH_SECRET`   | Long random string for refresh tokens            |
   | `GMAIL_USER`           | Gmail address for email alerts (optional)        |
   | `GMAIL_APP_PASSWORD`   | 16-char Gmail app password (optional)            |

4. Apply the schema in Supabase (SQL Editor) or with the CLI.

5. Run the backend and frontend:

   ```bash
   cd backend && npm run dev   # http://localhost:3000
   cd frontend && npm run dev  # http://localhost:5173
   ```

## Security

**Never commit secrets.** The `.env` files are gitignored. Use the `.env.example` template and keep
your real keys local. If you ever commit a secret, rotate it immediately (regenerate keys, change
passwords). For details, see [SECURITY.md](SECURITY.md).

## License

MIT