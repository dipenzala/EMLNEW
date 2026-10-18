import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { emailSchema } from '@/lib/validation';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  const { data: campaign } = await admin.from('campaigns').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const contacts = body.contacts as Array<{ email: string; first_name?: string; company_name?: string }>;
  if (!Array.isArray(contacts) || contacts.length === 0) return NextResponse.json({ error: 'no contacts provided' }, { status: 400 });

  const valid = contacts.filter((c) => emailSchema.safeParse(c.email).success).map((c) => ({
    user_id: user.id,
    campaign_id: params.id,
    email: c.email.toLowerCase().trim(),
    first_name: c.first_name || null,
    company_name: c.company_name || null,
    source: 'campaign-import',
  }));

  let inserted = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const { error, count } = await admin.from('contacts').upsert(valid.slice(i, i + 500), { onConflict: 'campaign_id,email', ignoreDuplicates: true, count: 'exact' });
    if (!error) inserted += count ?? 0;
  }
  return NextResponse.json({ ok: true, inserted });
}
