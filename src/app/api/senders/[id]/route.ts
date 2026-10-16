import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { log } from '@/lib/logger';
const patchSchema = z.object({ paused: z.boolean().optional(), daily_cap: z.number().int().min(1).max(350).optional() });
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(); const body = await req.json().catch(() => ({})); const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { data: owned } = await admin.from('sender_accounts').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { error } = await admin.from('sender_accounts').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  log('sender.patch', { userId: user.id, senderId: params.id, patch: parsed.data });
  return NextResponse.json({ ok: true });
}
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(); const admin = createSupabaseAdmin();
  const { data: owned } = await admin.from('sender_accounts').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await admin.from('sender_accounts').update({
    status: 'revoked',
    access_token_enc: null, refresh_token_enc: null, token_expiry: null,
    smtp_password_enc: null,
    updated_at: new Date().toISOString()
  }).eq('id', params.id);
  log('sender.revoke', { userId: user.id, senderId: params.id });
  return NextResponse.json({ ok: true });
}
