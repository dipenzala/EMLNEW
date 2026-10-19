-- 1. Ensure campaign_id exists and is clean
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- 2. Drop old constraints that cause import fails
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_user_id_email_key;
DROP INDEX IF EXISTS uniq_global_contact;
DROP INDEX IF EXISTS uniq_campaign_contact;

-- 3. Create separate indexes for Global and Campaign Contacts
-- This allows the same email to be in a campaign AND in global list without conflict
CREATE UNIQUE INDEX uniq_global_contact ON public.contacts(user_id, email) WHERE campaign_id IS NULL;
CREATE UNIQUE INDEX uniq_campaign_contact ON public.contacts(campaign_id, email) WHERE campaign_id IS NOT NULL;

-- 4. Enable RLS and add missing policies
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_rows ON public.contacts;
CREATE POLICY own_rows ON public.contacts FOR ALL USING (auth.uid() = user_id);
