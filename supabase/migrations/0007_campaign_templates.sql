alter table public.campaigns add column if not exists template_id uuid references public.email_templates(id) on delete set null;
