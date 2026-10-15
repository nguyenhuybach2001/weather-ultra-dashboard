-- Apply in Supabase SQL Editor. Existing telemetry tables are not modified.
create table if not exists public.push_subscriptions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_id text not null check (device_id = 'weather-ultra-01'),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;
-- No browser RLS policies: only the server service_role can access push endpoints.
