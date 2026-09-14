-- DronWatch Core Hardening: weighted retention aggregates.
-- Run this in the Supabase SQL editor BEFORE deploying the matching backend code
-- (the code falls back to avg-only mode if the columns are missing, so order is safe).
alter table hourly_stats add column if not exists response_sum_ms numeric;
alter table hourly_stats add column if not exists response_count integer not null default 0;
alter table daily_stats add column if not exists response_sum_ms numeric;
alter table daily_stats add column if not exists response_count integer not null default 0;
