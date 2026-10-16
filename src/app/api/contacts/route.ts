import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { csvEscape } from '@/lib/csv';
export async function GET(req: Request) {
  const user = await requireUser(); const url = new URL(req.url); const sb = createSupabaseServer();
  if (url.searchParams.get('count') === '1') {
    const { count } = await sb.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    return NextResponse.json({ count: count ?? 0 });
  }
  if (url.searchParams.get('export') === '1') {
    const { data } = await sb.from('contacts').select('email,first_name,last_name,company_name,tags,unsubscribed,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    const rows = [['email','first_name','last_name','company_name','tags','unsubscribed','created_at'].join(','),
      ...(data ?? []).map((c) => [csvEscape(c.email), csvEscape(c.first_name), csvEscape(c.last_name), csvEscape(c.company_name), csvEscape((c.tags ?? []).join(';')), csvEscape(c.unsubscribed), csvEscape(c.created_at)].join(','))].join('\n');
    return new NextResponse(rows, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="contacts.csv"' } });
  }
  const q = url.searchParams.get('q')?.trim() ?? ''; const page = Math.max(1, Number(url.searchParams.get('page') ?? 1)); const from = (page - 1) * 50;
  let query = sb.from('contacts').select('id,email,first_name,last_name,company_name,tags,unsubscribed,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).range(from, from + 49);
  if (q) query = query.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,company_name.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
