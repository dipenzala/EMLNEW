-- Tracking events table
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.email_jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  event_type text check (event_type in ('open', 'click')),
  url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_events_job on public.email_events(job_id);
