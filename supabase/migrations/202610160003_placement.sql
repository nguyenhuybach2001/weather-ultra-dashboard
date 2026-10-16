create table if not exists public.device_placement (
 device_id text primary key, config jsonb not null, revision uuid not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.device_placement_status (
 device_id text primary key, config jsonb not null,
 applied_revision uuid, applied_at timestamptz, last_seen timestamptz not null
);
alter table public.device_placement enable row level security;
alter table public.device_placement_status enable row level security;
revoke all on public.device_placement, public.device_placement_status from anon, authenticated;
grant all on public.device_placement, public.device_placement_status to service_role;
-- Existing rows stay NULL: unknown historical placement must not be relabelled.
alter table public.device_latest add column if not exists placement jsonb;
alter table public.weather_readings add column if not exists placement jsonb;
