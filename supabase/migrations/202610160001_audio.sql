-- Only trusted servers and the Pi service credential may access these tables.
create table if not exists public.device_audio (
 device_id text primary key,
 volume integer not null default 70 check (volume between 0 and 100),
 muted boolean not null default false,
 revision uuid not null,
 test_id uuid,
 test_expires_at timestamptz
);
create table if not exists public.device_audio_status (
 device_id text primary key,
 volume integer not null,
 muted boolean not null,
 applied_revision uuid,
 test_id uuid,
 test_result text,
 last_seen timestamptz not null
);
alter table public.device_audio enable row level security;
alter table public.device_audio_status enable row level security;
revoke all on public.device_audio, public.device_audio_status from anon, authenticated;
grant all on public.device_audio, public.device_audio_status to service_role;
