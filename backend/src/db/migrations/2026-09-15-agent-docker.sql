-- Agent 2.0 + Docker monitoring
alter table system_stats add column if not exists extra jsonb;
alter table system_stats add column if not exists uptime integer;
alter table system_stats add column if not exists temperature numeric;
alter table system_stats add column if not exists services jsonb;
