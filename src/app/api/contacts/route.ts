import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const sb = createSupabaseServer();
  
  // Only fetch GLOBAL contacts (campaign_id IS NULL)
  let query = sb.from('contacts')
    .select('id, email, first_name, unsubscribed, created_at')
    .eq('user_id', user.id)
    .is('campaign_id', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
