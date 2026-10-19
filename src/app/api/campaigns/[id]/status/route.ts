import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const sb = createSupabaseServer();
  
  const { data, error } = await sb
    .from('email_jobs')
    .select('to_email, status, created_at')
    .eq('campaign_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10); // Just show the last 10 to keep UI fast

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
