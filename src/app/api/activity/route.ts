import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
export async function GET() {
  const user = await requireUser(); const sb = createSupabaseServer();
  const { data, error } = await sb.from('audit_logs').select('id,action,detail,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
