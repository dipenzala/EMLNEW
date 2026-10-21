import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  const { data: c } = await admin.from('campaigns').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete jobs and contacts for this campaign
  await admin.from('email_jobs').delete().eq('campaign_id', params.id);
  await admin.from('contacts').delete().eq('campaign_id', params.id);

  return NextResponse.json({ ok: true });
}
