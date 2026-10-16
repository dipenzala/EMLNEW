import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
export async function GET() {
  await requireUser();
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('sender_accounts')
    .select('id,provider,google_email,display_name,status,paused,daily_cap,last_error,last_used_at,created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
