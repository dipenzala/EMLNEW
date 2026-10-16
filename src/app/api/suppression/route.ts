import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { csvEscape } from '@/lib/csv';
const schema = z.object({ email: z.string().email(), reason: z.string().max(120).default('manual') });
export async function GET(req: Request) {
  const user = await requireUser(); const sb = createSupabaseServer(); const url = new URL(req.url);
  if (url.searchParams.get('export') === '1') {
    const { data } = await sb.from('suppression_list').select('email,reason,created_at').eq('user_id', user.id);
    const csv = ['email,reason,created_at', ...(data ?? []).map((r) => [csvEscape(r.email), csvEscape(r.reason), csvEscape(r.created_at)].join(','))].join('\n');
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="suppression.csv"' } });
  }
  const { data, error } = await sb.from('suppression_list').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
export async function POST(req: Request) {
  const user = await requireUser(); const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const sb = createSupabaseServer();
  const { error } = await sb.from('suppression_list').upsert({ user_id: user.id, email: parsed.data.email.toLowerCase(), reason: parsed.data.reason }, { onConflict: 'user_id,email' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
