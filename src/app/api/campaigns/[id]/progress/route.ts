import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const sb = createSupabaseServer();
  
  const { data, error } = await sb.from('email_jobs')
    .select('status')
    .eq('campaign_id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const counts: Record<string, number> = { total: 0, queued: 0, accepted: 0, failed: 0 };
  for (const row of data || []) {
    counts.total++;
    if (row.status === 'queued' || row.status === 'processing') counts.queued++;
    else if (row.status === 'accepted') counts.accepted++;
    else if (row.status === 'failed' || row.status === 'uncertain') counts.failed++;
  }
  
  return NextResponse.json(counts);
}
