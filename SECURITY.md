# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities by opening a private advisory on GitHub
(Repository → Security → Report a vulnerability) instead of opening a public issue.

In your report, include:

- The affected endpoints or components
- A description of the vulnerability and impact
- Steps to reproduce, if possible

We aim to acknowledge reports within 48 hours.

## Secrets & key handling

This project uses environment variables for all secrets:

- `backend/.env` — `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and optional SMTP
  credentials. This file is gitignored and must never be committed.
- `frontend/.env` — only `VITE_API_URL` (public, not a secret; never put service keys here).

Please follow these rules:

- Never commit `.env` files; use the `.env.example` templates with placeholder values.
- Never paste API keys, tokens, or passwords into issues, PRs, or support chats.
- If a secret is ever exposed in a commit or a PR, assume it is compromised and rotate it:

  - Supabase: revoke the service-role key and rotate the published keys in the dashboard.
  - Change the JWT secrets and regenerate the tokens.
  - Revoke any API keys that may have been leaked.

## Current defenses

- Passwords hashed with bcrypt (cost 12) and validated against a policy: 8-128 characters
  with at least one letter and one number (enforced on the backend and the frontend).
- JWT access/refresh tokens: access tokens carry a `type: access` claim and are short-lived
  (default 15m); refresh tokens are stateful, stored hashed, rotated on every use, and revoked
  on logout or password change (`user_sessions` table).
- Login lockout: 5 failed attempts per account+IP block the account from that IP for 15 minutes.
- Rate limiting (all per IP, in-memory):
  - Global API: 300 req/min
  - Auth (`register`, `login`, `forgot-password`): 20 req / 15 min
  - Refresh: 60 req/min
- Helmet security headers (CSP, X-Frame-Options, HSTS with preload, referrer policy) and no
  `X-Powered-By`.
- Strict CORS: only the configured `FRONTEND_URL` origin is allowed; other origins are rejected
  with 403. Requests without an `Origin` header (curl, agents) are allowed.
- Only `GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD` are accepted; others return 405.
- Body size limits: JSON 1 MB, URL-encoded 64 KB.
- Input validation via zod on every mutating endpoint (length caps, enums, email format,
  key/value rules for env vars, uuid checks) plus a global error handler that never leaks stack
  traces.
- SSRF guard in the monitor engine: HTTP, TCP, SSL and ping checks block private, loopback and
  link-local addresses by default (`allow_private_ips: true` in a monitor config opts out).
  Heartbeat tokens are compared in constant time (SHA-256 + `timingSafeEqual`).
- Row Level Security enabled on all tables (defense-in-depth against direct database access).
  The Node backend uses the service-role key, which bypasses RLS, so public API flows are
  unaffected. Direct `anon`/`authenticated` clients can never read other users' data.
- HTML escaping of monitor/alert data in outgoing email templates.
- Supported HTTPS deployment: set `TRUST_PROXY` in the server environment when running behind a
  reverse proxy so rate limits and IP-based lockout see real client IPs.

## Supported versions

Only the current `main` branch is supported. We do not maintain security patches for older
releases.