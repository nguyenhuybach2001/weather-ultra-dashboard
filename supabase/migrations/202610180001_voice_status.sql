-- Uses existing service-role-only access on device_audio_status.
alter table public.device_audio_status add column if not exists voice jsonb;
