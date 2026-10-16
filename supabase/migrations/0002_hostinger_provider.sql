-- CertWinX migration 0002: Hostinger Mail (SMTP) provider support
-- Only needed if you already ran 0001_init.sql before this update.
-- Safe to run on a fresh DB too — all statements are idempotent.

alter table public.sender_accounts
  add column if not exists provider text not null default 'gmail',
  add column if not exists smtp_host text,
  add column if not exists smtp_port int,
  add column if not exists smtp_user text,
  add column if not exists smtp_password_enc text,
  add column if not exists smtp_secure boolean not null default true;

alter table public.sender_accounts drop constraint if exists sender_accounts_provider_check;
alter table public.sender_accounts
  add constraint sender_accounts_provider_check check (provider in ('gmail','hostinger'));

-- Replace unique(user_id, google_email) with unique(user_id, provider, google_email)
alter table public.sender_accounts drop constraint if exists sender_accounts_user_id_google_email_key;
alter table public.sender_accounts drop constraint if exists sender_accounts_user_provider_email_key;
alter table public.sender_accounts
  add constraint sender_accounts_user_provider_email_key unique (user_id, provider, google_email);

create index if not exists idx_sender_user_provider on public.sender_accounts(user_id, provider);
