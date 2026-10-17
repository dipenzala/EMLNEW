import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { verifyHostingerSmtp } from '@/lib/mailer';
import { log, logError } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
  display_name: z.string().max(200).optional(),
  smtp_host: z.string().max(200).optional(),
  smtp_port: z.number().int().min(1).max(65535).optional(),
  smtp_secure: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!rateLimit(`hostinger-connect:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password, display_name, smtp_host, smtp_port, smtp_secure } = parsed.data;

  // 1) Verify live SMTP connection before saving
  try {
    await verifyHostingerSmtp({
      host: smtp_host,
      port: smtp_port,
      secure: smtp_secure,
      user: email,
      pass: password,
    });
  } catch (e) {
    logError('hostinger.verify_failed', e, { email });
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `SMTP verify failed: ${msg}. Check email, password, host (smtp.hostinger.com / smtp.titan.email), and that your Hostinger email plan is active.` },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();
  const row = {
    user_id: user.id,
    provider: 'hostinger',
    google_email: email,
    display_name: display_name || 'Startup India Certificate',
    status: 'connected',
    paused: false,
    smtp_host: smtp_host || 'smtp.hostinger.com',
    smtp_port: smtp_port ?? 465,
    smtp_secure: smtp_secure !== false,
    smtp_user: email,
    smtp_password_enc: encrypt(password),
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from('sender_accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', 'hostinger')
    .eq('google_email', email)
    .maybeSingle();

  let senderId: string;
  if (existing) {
    const { error } = await admin.from('sender_accounts').update(row).eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    senderId = existing.id;
  } else {
    const { data, error } = await admin.from('sender_accounts').insert(row).select('id').single();
    if (error || !data) return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 });
    senderId = data.id;
  }
  log('hostinger.connected', { userId: user.id, senderId });
  return NextResponse.json({ ok: true, id: senderId });
}
