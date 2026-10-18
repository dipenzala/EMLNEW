import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { sanitizeUserHtml } from '@/lib/template';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('email_templates').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const sb = createSupabaseServer();
  const { error } = await sb.from('email_templates').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
