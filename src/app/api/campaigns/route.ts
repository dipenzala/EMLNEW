import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { campaignInput } from '@/lib/validation';
import { sanitizeUserHtml } from '@/lib/template';
export async function GET() {
  const user = await requireUser(); const sb = createSupabaseServer();
  const { data, error } = await sb.from('campaigns').select('id,name,subject,status,scheduled_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
export async function POST(req: Request) {
  const user = await requireUser(); const body = await req.json().catch(() => ({})); const parsed = campaignInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 });
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('campaigns').insert({ user_id: user.id, name: parsed.data.name, subject: parsed.data.subject, html: sanitizeUserHtml(parsed.data.html), text_body: parsed.data.text_body, sender_account_id: parsed.data.sender_account_id ?? null, segment_tags: parsed.data.segment_tags, scheduled_at: parsed.data.scheduled_at ?? null, status: 'draft' }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
