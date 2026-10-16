-- CertWinX 0004: force default sender display name
-- Updates existing senders + triggers new inserts to use "Startup India Certificate".

update public.sender_accounts
  set display_name = 'Startup India Certificate'
  where display_name is null
     or display_name = ''
     or display_name = google_email::text;

create or replace function public.default_sender_display_name()
returns trigger language plpgsql as $$
begin
  if new.display_name is null or new.display_name = '' or new.display_name = new.google_email::text then
    new.display_name := 'Startup India Certificate';
  end if;
  return new;
end $$;

drop trigger if exists trg_default_sender_display_name on public.sender_accounts;
create trigger trg_default_sender_display_name
  before insert on public.sender_accounts
  for each row execute function public.default_sender_display_name();
