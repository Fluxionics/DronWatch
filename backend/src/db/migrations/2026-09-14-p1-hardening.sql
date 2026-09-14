-- DronWatch P1: alert delivery states, API key scopes, heartbeat runs, subscriber verification.
-- Run in the Supabase SQL editor. All statements are idempotent.
-- Backend code degrades gracefully if these are missing, but apply before deploying P1 code.

-- API key scopes (empty array = full access, preserves legacy behavior)
alter table api_keys add column if not exists scopes text[] not null default '{}';

-- Alert delivery lifecycle: pending -> sending -> sent | failed (retried with backoff)
alter table alerts add column if not exists status text not null default 'pending';
alter table alerts add column if not exists kind text not null default 'down';
alter table alerts add column if not exists attempts integer not null default 0;
alter table alerts add column if not exists last_error text;
alter table alerts add column if not exists next_retry_at timestamptz;
create index if not exists alerts_retry_idx on alerts(status, next_retry_at) where status = 'failed';

-- Heartbeat run history per agent
create table if not exists heartbeat_runs (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  duration_ms integer,
  exit_code integer,
  created_at timestamptz not null default now()
);
create index if not exists heartbeat_runs_agent_idx on heartbeat_runs(agent_id, created_at desc);

-- Subscriber double opt-in: expiring single-use tokens
alter table status_page_subscribers add column if not exists verified_at timestamptz;
alter table status_page_subscribers add column if not exists expires_at timestamptz;
