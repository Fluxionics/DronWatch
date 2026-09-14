# Privacy Policy

DronWatch is monitoring software you (or your organization) host and operate. This
policy describes what data the software stores and how it is handled. If you use a
DronWatch instance run by someone else, that operator is responsible for the data;
contact them with privacy questions.

## Data stored

- **Account**: username, optional email, password hash (bcrypt, never plaintext),
  plan, preferences and API keys (stored hashed).
- **Monitors**: names, URLs, check configuration (headers, cookies, auth credentials
  you enter, intervals, notification channels), check results and timings, downtime
  history and aggregated statistics.
- **Alerts**: notification history including channel type, recipient address and
  message content, plus delivery status.
- **Incidents**: statuses, updates, tasks and postmortems you write.
- **Status pages**: configuration, branding, subscriber emails and verification state.
- **Agents**: system metrics reported by your agents (CPU, memory, disk, load,
  processes, network counters) and heartbeat history.
- **Logs**: log entries you ingest for pattern alerting.
- **Sessions**: login sessions (hashed tokens, expiry) for authentication.

## Where it lives

All data lives in the PostgreSQL database of the deployment (Supabase in the
reference setup), plus environment variables on the server. The frontend stores your
login tokens in the browser's local storage so you stay signed in. There is no
advertising, no analytics beacon and no third-party tracker in the application.

## Retention

- Raw check results: 7 days by default (configurable).
- Hourly aggregates: 90 days; daily aggregates: 730 days (configurable).
- Alert history, incidents and status pages are kept until you delete them.

## Emails

Emails are sent only for: account password resets, monitor down/recovery alerts to
channels you configured, status-page notifications to verified subscribers, and
scheduled reports you enabled. Every status-page email includes an unsubscribe link.

## Your rights

- **Export**: monitors and check history can be exported as CSV/JSON from the UI.
- **Delete**: deleting a monitor removes its checks, alerts and incidents; deleting
  your account removes everything associated with it.
- **Access/correction**: update your username and API keys in Settings at any time.

## Operators

If you self-host DronWatch for other people: secure your `SUPABASE_SERVICE_KEY` and
JWT secrets, serve everything over HTTPS, keep backups of the database, and publish
your own contact for privacy requests. This file is a starting template, not legal
advice — adapt it to your jurisdiction.
