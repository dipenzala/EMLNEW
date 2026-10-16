import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(); const sb = createSupabaseServer();
  const { data, error } = await sb.from('email_jobs').select('status').eq('campaign_id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  counts.total = data?.length ?? 0;
  return NextResponse.json(counts);
}
