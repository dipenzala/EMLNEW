import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const sb = createSupabaseServer();
  
  const query = () => sb.from('email_jobs').select('*', { count: 'exact', head: true }).eq('campaign_id', params.id).eq('user_id', user.id);

  const { count: total } = await query();
  const { count: queued } = await query().eq('status', 'queued');
  const { count: accepted } = await query().eq('status', 'accepted');
  const { count: failed } = await query().eq('status', 'failed');

  return NextResponse.json({ 
    total: total || 0, 
    queued: queued || 0, 
    accepted: accepted || 0, 
    failed: failed || 0 
  });
}
