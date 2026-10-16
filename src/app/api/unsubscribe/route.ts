import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { log } from '@/lib/logger';
export async function POST(req: Request) {
  const ct = req.headers.get('content-type') ?? ''; let token: string | null = null;
  if (ct.includes('application/json')) { const body = await req.json().catch(() => ({})); token = body.token ?? null; }
  else { const form = await req.formData().catch(() => null); token = (form?.get('token') as string) ?? null; }
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { data: tok } = await admin.from('unsubscribe_tokens').select('*').eq('token', token).maybeSingle();
  if (!tok) return NextResponse.json({ error: 'invalid token' }, { status: 400 });
  if (tok.used) return NextResponse.json({ ok: true, already: true });
  const { data: contact } = await admin.from('contacts').select('*').eq('id', tok.contact_id).maybeSingle();
  if (!contact) return NextResponse.json({ error: 'contact not found' }, { status: 404 });
  await admin.from('contacts').update({ unsubscribed: true }).eq('id', contact.id);
  await admin.from('suppression_list').upsert({ user_id: tok.user_id, email: contact.email, reason: 'unsubscribe' }, { onConflict: 'user_id,email' });
  await admin.from('unsubscribe_tokens').update({ used: true }).eq('token', token);
  log('unsubscribe.processed', { userId: tok.user_id, contactId: contact.id });
  if (ct.includes('application/json')) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL('/unsubscribe?ok=1', req.url), { status: 303 });
}
export const dynamic = 'force-dynamic';
