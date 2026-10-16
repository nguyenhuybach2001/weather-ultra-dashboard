create table if not exists public.device_morning (
 device_id text primary key,
 enabled boolean not null default false,
 time_local text not null default '07:00' check (time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 revision uuid not null,
 request_id uuid,
 request_expires_at timestamptz
);
create table if not exists public.device_morning_status (
 device_id text primary key,
 applied_revision uuid,
 last_seen timestamptz not null,
 result text,
 bulletin text,
 forecast_date date,
 last_attempt_at timestamptz
);
alter table public.device_morning enable row level security;
alter table public.device_morning_status enable row level security;
revoke all on public.device_morning, public.device_morning_status from anon, authenticated;
grant all on public.device_morning, public.device_morning_status to service_role;
