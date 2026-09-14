-- Escalation policies for Smart Alerting
create table if not exists escalation_policies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists escalation_policies_user_idx on escalation_policies(user_id);

create table if not exists escalation_states (
  id uuid primary key default uuid_generate_v4(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  policy_id uuid not null references escalation_policies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  started_at timestamptz not null default now(),
  current_step integer not null default 0,
  last_notified_at timestamptz,
  is_active boolean not null default true,
  unique(monitor_id, policy_id)
);
create index if not exists escalation_states_active_idx on escalation_states(is_active, started_at) where is_active = true;

alter table monitors add column if not exists escalation_policy_id uuid references escalation_policies(id) on delete set null;

-- Extend alert_rules conditions for Smart Alerting
alter table alert_rules drop constraint if exists alert_rules_condition_check;
alter table alert_rules add constraint alert_rules_condition_check check (condition in ('down_for','latency_above','ssl_expires_within','status_code','keyword','response_size_above','error_rate_above'));
