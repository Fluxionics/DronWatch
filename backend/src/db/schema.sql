create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  email text,
  password_hash text not null,
  free_tier boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table users add column if not exists env_vars jsonb not null default '{}';

create table if not exists monitors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  url text not null,
  name text not null,
  type text not null default 'http',
  config jsonb not null default '{}',
  expected_status integer,
  check_interval integer not null default 300,
  is_active boolean not null default true,
  maintenance boolean not null default false,
  parent_monitor_id uuid references monitors(id) on delete set null,
  retry_count integer not null default 1,
  last_check timestamptz,
  last_status boolean,
  last_latency integer,
  notification_channels jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table monitors add column if not exists type text not null default 'http';
alter table monitors add column if not exists config jsonb not null default '{}';
alter table monitors add column if not exists expected_status integer;
alter table monitors add column if not exists maintenance boolean not null default false;
alter table monitors add column if not exists parent_monitor_id uuid references monitors(id) on delete set null;
alter table monitors add column if not exists retry_count integer not null default 1;
alter table monitors add column if not exists last_latency integer;
alter table monitors drop constraint if exists monitors_type_check;
alter table monitors add constraint monitors_type_check check (type in ('http','ping','tcp','keyword','heartbeat','dns','ssl','domain'));
alter table monitors add column if not exists priority integer not null default 0;
alter table monitors add column if not exists region text not null default 'auto';

create table if not exists checks (
  id uuid primary key default uuid_generate_v4(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  status_code integer,
  response_time integer,
  dns_time integer,
  tcp_time integer,
  tls_time integer,
  ttfb integer,
  is_up boolean not null,
  error_message text,
  checked_at timestamptz not null default now()
);
alter table checks add column if not exists dns_time integer;
alter table checks add column if not exists tcp_time integer;
alter table checks add column if not exists tls_time integer;
alter table checks add column if not exists ttfb integer;
alter table checks add column if not exists response_body_hash text;

create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  type text not null,
  recipient text not null,
  message text not null,
  is_sent boolean not null default false,
  sent_at timestamptz
);
alter table alerts drop constraint if exists alerts_type_check;
alter table alerts add constraint alerts_type_check check (type in ('email','slack','discord','webhook','telegram','teams','google_chat','pushover','gotify','mattermost','matrix','pagerduty','opsgenie','twilio_sms','jira','linear','github_issue','gitlab_issue','webpush'));

create table if not exists status_pages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  monitor_ids jsonb not null default '[]',
  groups jsonb not null default '[]',
  is_public boolean not null default true,
  password_hash text,
  custom_domain text,
  background_color text not null default '#0f172a',
  logo_url text,
  branding_default boolean not null default true,
  subscriptions_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table status_pages add column if not exists groups jsonb not null default '[]';
alter table status_pages add column if not exists password_hash text;
alter table status_pages add column if not exists custom_domain text;
alter table status_pages add column if not exists logo_url text;
alter table status_pages add column if not exists branding_default boolean not null default true;
alter table status_pages add column if not exists subscriptions_enabled boolean not null default true;

create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  key_hash text not null,
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists incidents (
  id uuid primary key default uuid_generate_v4(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'open',
  severity text not null default 'high',
  title text not null,
  assignee text,
  tags jsonb not null default '[]',
  started_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table incidents drop constraint if exists incidents_status_check;
alter table incidents add constraint incidents_status_check check (status in ('open','acknowledged','resolving','resolved','closed','reopened'));
alter table incidents drop constraint if exists incidents_severity_check;
alter table incidents add constraint incidents_severity_check check (severity in ('informational','low','medium','high','critical'));
alter table incidents add column if not exists assignee text;
alter table incidents add column if not exists tags jsonb not null default '[]';
alter table incidents add column if not exists closed_at timestamptz;

create table if not exists incident_updates (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  status text not null,
  message text not null,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);
alter table incident_updates add column if not exists visibility text not null default 'public';

create table if not exists incident_tasks (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists incident_postmortems (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  root_cause text,
  timeline text,
  actions text,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_windows (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  monitor_ids jsonb not null default '[]',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists silences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  monitor_id uuid references monitors(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  unique(team_id, email)
);
alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check check (role in ('owner','admin','operator','viewer','auditor'));

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

create table if not exists status_page_subscribers (
  id uuid primary key default uuid_generate_v4(),
  status_page_id uuid not null references status_pages(id) on delete cascade,
  email text not null,
  verified boolean not null default false,
  token text,
  created_at timestamptz not null default now(),
  unique(status_page_id, email)
);

create table if not exists user_env_vars (
  user_id uuid not null references users(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (user_id, key)
);

create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  token_hash text not null,
  platform text,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists system_stats (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  cpu numeric,
  mem numeric,
  disk numeric,
  load numeric,
  processes integer,
  containers integer,
  network_in integer,
  network_out integer,
  recorded_at timestamptz not null default now()
);

create table if not exists logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  monitor_id uuid references monitors(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  service text,
  level text not null default 'info',
  message text not null,
  tags jsonb not null default '[]',
  ts timestamptz not null default now()
);

create table if not exists report_schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  days integer not null default 30,
  next_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists monitors_user_idx on monitors(user_id);
create index if not exists monitors_active_idx on monitors(is_active, last_check);
create index if not exists monitors_type_idx on monitors(type);
create index if not exists checks_monitor_idx on checks(monitor_id, checked_at desc);
create index if not exists alerts_monitor_idx on alerts(monitor_id);
create index if not exists status_pages_slug_idx on status_pages(slug);
create index if not exists api_keys_hash_idx on api_keys(key_hash);
create index if not exists incidents_monitor_idx on incidents(monitor_id, status);
create index if not exists incident_updates_incident_idx on incident_updates(incident_id);
create index if not exists maintenance_user_idx on maintenance_windows(user_id);
create index if not exists silences_user_idx on silences(user_id, monitor_id);
create index if not exists audit_user_idx on audit_logs(user_id, created_at desc);
create index if not exists logs_monitor_idx on logs(monitor_id, ts desc);
create index if not exists system_stats_agent_idx on system_stats(agent_id, recorded_at desc);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on users;
create trigger users_updated_at before update on users
  for each row execute function update_updated_at();

drop trigger if exists monitors_updated_at on monitors;
create trigger monitors_updated_at before update on monitors
  for each row execute function update_updated_at();

-- =====================================================================
-- Row Level Security (defense-in-depth; the Node backend uses the
-- service-role key which bypasses RLS, so public API flows are unaffected)
-- =====================================================================

alter table users enable row level security;
alter table user_sessions enable row level security;
alter table monitors enable row level security;
alter table checks enable row level security;
alter table alerts enable row level security;
alter table status_pages enable row level security;
alter table api_keys enable row level security;
alter table incidents enable row level security;
alter table incident_updates enable row level security;
alter table incident_tasks enable row level security;
alter table incident_postmortems enable row level security;
alter table maintenance_windows enable row level security;
alter table silences enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table audit_logs enable row level security;
alter table status_page_subscribers enable row level security;
alter table user_env_vars enable row level security;
alter table agents enable row level security;
alter table system_stats enable row level security;
alter table logs enable row level security;
alter table report_schedules enable row level security;

drop policy if exists rls_users_select on users;
create policy rls_users_select on users for select to authenticated using (id = auth.uid());
drop policy if exists rls_users_update on users;
create policy rls_users_update on users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists rls_users_delete on users;
create policy rls_users_delete on users for delete to authenticated using (id = auth.uid());

drop policy if exists rls_user_sessions_all on user_sessions;
create policy rls_user_sessions_all on user_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function policy_user_owned(tbl text)
returns text language plpgsql as $$
begin
  execute format('
    drop policy if exists rls_%s_select on %I;
    create policy rls_%s_select on %I for select to authenticated using (user_id = auth.uid());
    drop policy if exists rls_%s_insert on %I;
    create policy rls_%s_insert on %I for insert to authenticated with check (user_id = auth.uid());
    drop policy if exists rls_%s_update on %I;
    create policy rls_%s_update on %I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    drop policy if exists rls_%s_delete on %I;
    create policy rls_%s_delete on %I for delete to authenticated using (user_id = auth.uid());
  ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  return tbl;
end;
$$;

select policy_user_owned('monitors');
select policy_user_owned('api_keys');
select policy_user_owned('incidents');
select policy_user_owned('maintenance_windows');
select policy_user_owned('silences');
select policy_user_owned('teams');
select policy_user_owned('audit_logs');
select policy_user_owned('user_env_vars');
select policy_user_owned('agents');
select policy_user_owned('logs');
select policy_user_owned('report_schedules');

drop policy if exists rls_checks_select on checks;
create policy rls_checks_select on checks for select to authenticated
  using (exists (select 1 from monitors m where m.id = checks.monitor_id and m.user_id = auth.uid()));
drop policy if exists rls_checks_insert on checks;
create policy rls_checks_insert on checks for insert to authenticated
  with check (exists (select 1 from monitors m where m.id = checks.monitor_id and m.user_id = auth.uid()));

drop policy if exists rls_alerts_select on alerts;
create policy rls_alerts_select on alerts for select to authenticated
  using (exists (select 1 from monitors m where m.id = alerts.monitor_id and m.user_id = auth.uid()));
drop policy if exists rls_alerts_insert on alerts;
create policy rls_alerts_insert on alerts for insert to authenticated
  with check (exists (select 1 from monitors m where m.id = alerts.monitor_id and m.user_id = auth.uid()));
drop policy if exists rls_alerts_update on alerts;
create policy rls_alerts_update on alerts for update to authenticated
  using (exists (select 1 from monitors m where m.id = alerts.monitor_id and m.user_id = auth.uid()));
drop policy if exists rls_alerts_delete on alerts;
create policy rls_alerts_delete on alerts for delete to authenticated
  using (exists (select 1 from monitors m where m.id = alerts.monitor_id and m.user_id = auth.uid()));

drop policy if exists rls_incident_updates_all on incident_updates;
create policy rls_incident_updates_all on incident_updates for all to authenticated
  using (exists (select 1 from incidents i where i.id = incident_updates.incident_id and i.user_id = auth.uid()))
  with check (exists (select 1 from incidents i where i.id = incident_updates.incident_id and i.user_id = auth.uid()));
drop policy if exists rls_incident_tasks_all on incident_tasks;
create policy rls_incident_tasks_all on incident_tasks for all to authenticated
  using (exists (select 1 from incidents i where i.id = incident_tasks.incident_id and i.user_id = auth.uid()))
  with check (exists (select 1 from incidents i where i.id = incident_tasks.incident_id and i.user_id = auth.uid()));
drop policy if exists rls_incident_postmortems_all on incident_postmortems;
create policy rls_incident_postmortems_all on incident_postmortems for all to authenticated
  using (exists (select 1 from incidents i where i.id = incident_postmortems.incident_id and i.user_id = auth.uid()))
  with check (exists (select 1 from incidents i where i.id = incident_postmortems.incident_id and i.user_id = auth.uid()));

drop policy if exists rls_team_members_all on team_members;
create policy rls_team_members_all on team_members for all to authenticated
  using (exists (select 1 from teams t where t.id = team_members.team_id and t.user_id = auth.uid()))
  with check (exists (select 1 from teams t where t.id = team_members.team_id and t.user_id = auth.uid()));

drop policy if exists rls_system_stats_select on system_stats;
create policy rls_system_stats_select on system_stats for select to authenticated
  using (exists (select 1 from agents a where a.id = system_stats.agent_id and a.user_id = auth.uid()));
drop policy if exists rls_system_stats_insert on system_stats;
create policy rls_system_stats_insert on system_stats for insert to authenticated
  with check (exists (select 1 from agents a where a.id = system_stats.agent_id and a.user_id = auth.uid()));

drop policy if exists rls_status_pages_select on status_pages;
create policy rls_status_pages_select on status_pages for select to authenticated using (user_id = auth.uid());
drop policy if exists rls_status_pages_insert on status_pages;
create policy rls_status_pages_insert on status_pages for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rls_status_pages_update on status_pages;
create policy rls_status_pages_update on status_pages for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists rls_status_pages_delete on status_pages;
create policy rls_status_pages_delete on status_pages for delete to authenticated using (user_id = auth.uid());

drop policy if exists rls_status_page_subscribers_select on status_page_subscribers;
create policy rls_status_page_subscribers_select on status_page_subscribers for select to authenticated
  using (exists (select 1 from status_pages s where s.id = status_page_subscribers.status_page_id and s.user_id = auth.uid()));
drop policy if exists rls_status_page_subscribers_update on status_page_subscribers;
create policy rls_status_page_subscribers_update on status_page_subscribers for update to authenticated
  using (exists (select 1 from status_pages s where s.id = status_page_subscribers.status_page_id and s.user_id = auth.uid()));
drop policy if exists rls_status_page_subscribers_delete on status_page_subscribers;
create policy rls_status_page_subscribers_delete on status_page_subscribers for delete to authenticated
  using (exists (select 1 from status_pages s where s.id = status_page_subscribers.status_page_id and s.user_id = auth.uid()));