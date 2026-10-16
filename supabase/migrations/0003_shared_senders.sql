-- CertWinX 0003: shared sender pool
-- Every signed-in user (including guests) can see and use every sender.

drop policy if exists own_rows on public.sender_accounts;
drop policy if exists shared_senders_read on public.sender_accounts;
drop policy if exists shared_senders_insert on public.sender_accounts;
drop policy if exists shared_senders_update on public.sender_accounts;
drop policy if exists shared_senders_delete on public.sender_accounts;

create policy shared_senders_read on public.sender_accounts
  for select using (auth.uid() is not null);

create policy shared_senders_insert on public.sender_accounts
  for insert with check (auth.uid() is not null);

create policy shared_senders_update on public.sender_accounts
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy shared_senders_delete on public.sender_accounts
  for delete using (auth.uid() is not null);
