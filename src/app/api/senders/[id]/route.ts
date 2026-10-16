import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { log } from '@/lib/logger';

const patchSchema = z.object({
  paused: z.boolean().optional(),
  daily_cap: z.number().int().min(1).max(350).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { error } = await admin.from('sender_accounts').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  log('sender.patch.shared', { userId: user.id, senderId: params.id, patch: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  await admin.from('sender_accounts').update({
    status: 'revoked',
    access_token_enc: null,
    refresh_token_enc: null,
    token_expiry: null,
    smtp_password_enc: null,
    updated_at: new Date().toISOString(),
  }).eq('id', params.id);
  log('sender.revoke.shared', { userId: user.id, senderId: params.id });
  return NextResponse.json({ ok: true });
}
