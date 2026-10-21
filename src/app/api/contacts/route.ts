import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sb = createSupabaseServer();
    const url = new URL(req.url);
    const cid = url.searchParams.get('campaign_id');
    const countOnly = url.searchParams.get('count') === '1';

    let query = sb.from('contacts').select('*', { count: 'exact' }).eq('user_id', user.id);
    
    if (cid) {
      query = query.eq('campaign_id', cid);
    } else {
      query = query.is('campaign_id', null);
    }

    if (countOnly) {
      const { count } = await query;
      return NextResponse.json({ count: count || 0 });
    }

    const { data } = await query.limit(100);
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
