-- CertWinX initial schema (includes Hostinger Mail / SMTP support)
create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null,
  full_name text,
  company_name text,
  timezone text not null default 'Asia/Kolkata',
  default_sender_id uuid,
  batch_size int not null default 5 check (batch_size between 1 and 50),
  sender_daily_cap int not null default 350 check (sender_daily_cap between 1 and 350),
  global_sending_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sender_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'gmail' check (provider in ('gmail','hostinger')),
  google_email citext not null,
  display_name text,
  -- Gmail OAuth fields
  access_token_enc text,
  refresh_token_enc text,
  token_expiry timestamptz,
  scopes text,
  -- Hostinger SMTP fields
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_password_enc text,
  smtp_secure boolean not null default true,
  status text not null default 'connected' check (status in ('connected','revoked','error','paused')),
  paused boolean not null default false,
  daily_cap int not null default 350 check (daily_cap between 1 and 350),
  last_error text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, google_email)
);
create index if not exists idx_sender_user on public.sender_accounts(user_id);
create index if not exists idx_sender_user_provider on public.sender_accounts(user_id, provider);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email citext not null,
  first_name text,
  last_name text,
  company_name text,
  custom jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  source text,
  consent_basis text,
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);
create index if not exists idx_contacts_user on public.contacts(user_id);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null default '',
  html text not null default '',
  text_body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null default '',
  html text not null default '',
  text_body text not null default '',
  sender_account_id uuid references public.sender_accounts(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','running','paused','completed','cancelled','archived')),
  scheduled_at timestamptz,
  segment_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  sender_account_id uuid references public.sender_accounts(id) on delete set null,
  to_email citext not null,
  status text not null default 'queued' check (status in ('queued','processing','accepted','uncertain','failed','suppressed','cancelled')),
  attempts int not null default 0,
  last_error text,
  message_id text,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index if not exists idx_jobs_queue on public.email_jobs(status, next_attempt_at);

create table if not exists public.send_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_account_id uuid not null references public.sender_accounts(id) on delete cascade,
  job_id uuid references public.email_jobs(id) on delete set null,
  kind text not null check (kind in ('reserved','accepted','failed','uncertain','released')),
  created_at timestamptz not null default now()
);
create index if not exists idx_send_events_sender_time on public.send_events(sender_account_id, created_at desc);

create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email citext not null,
  reason text not null default 'unsubscribe',
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

create table if not exists public.unsubscribe_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.claim_jobs(p_user uuid, p_limit int)
returns setof public.email_jobs language plpgsql security definer as $$
begin
  return query
  with picked as (
    select id from public.email_jobs where user_id = p_user and status = 'queued' and next_attempt_at <= now()
    order by next_attempt_at asc, created_at asc for update skip locked limit greatest(p_limit, 1)
  )
  update public.email_jobs j set status = 'processing', attempts = j.attempts + 1, lease_until = now() + interval '2 minutes', updated_at = now()
  from picked where j.id = picked.id returning j.*;
end $$;

create or replace function public.reserve_sender_capacity(p_sender uuid, p_cap int)
returns boolean language plpgsql security definer as $$
declare used int;
begin
  perform 1 from public.sender_accounts where id = p_sender for update;
  select count(*) into used from public.send_events where sender_account_id = p_sender and kind in ('reserved','accepted') and created_at > now() - interval '24 hours';
  if used >= p_cap then return false; end if;
  insert into public.send_events(user_id, sender_account_id, kind) select user_id, id, 'reserved' from public.sender_accounts where id = p_sender;
  return true;
end $$;

alter table public.profiles enable row level security;
alter table public.sender_accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.email_templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.email_jobs enable row level security;
alter table public.send_events enable row level security;
alter table public.suppression_list enable row level security;
alter table public.unsubscribe_tokens enable row level security;
alter table public.oauth_states enable row level security;
alter table public.audit_logs enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['sender_accounts','contacts','email_templates','campaigns','email_jobs','send_events','suppression_list','unsubscribe_tokens','oauth_states','audit_logs']) loop
    execute format('drop policy if exists own_rows on public.%I;', t);
    execute format('create policy own_rows on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  for t in select unnest(array['profiles','sender_accounts','contacts','email_templates','campaigns','email_jobs']) loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I;', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;
