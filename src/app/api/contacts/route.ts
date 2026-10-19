import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const sb = createSupabaseServer();
  
  const campaignId = url.searchParams.get('campaign_id');
  const isCount = url.searchParams.get('count') === '1';

  let query = sb.from('contacts').select('id, email, first_name, created_at', { count: 'exact' }).eq('user_id', user.id);

  // Agar campaign_id hai, toh sirf usi campaign ke contacts gino
  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  } else {
    // Warna global contacts gino
    query = query.is('campaign_id', null);
  }

  if (isCount) {
    const { count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: count || 0 });
  }

  // Normal list fetch
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
