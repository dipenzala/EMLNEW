import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { campaignInput } from '@/lib/validation';
import { sanitizeUserHtml } from '@/lib/template';
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(); const sb = createSupabaseServer();
  const { data, error } = await sb.from('campaigns').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(); const body = await req.json().catch(() => ({})); const parsed = campaignInput.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 });
  const patch: Record<string, unknown> = { ...parsed.data };
  if (typeof patch.html === 'string') patch.html = sanitizeUserHtml(patch.html as string);
  const sb = createSupabaseServer();
  const { error } = await sb.from('campaigns').update(patch).eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
