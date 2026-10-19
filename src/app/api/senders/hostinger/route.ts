import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { verifyHostingerSmtp } from '@/lib/mailer';
import { log, logError } from '@/lib/logger';

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
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  
  const { email, password, smtp_host, smtp_port, smtp_secure } = parsed.data;

  try {
    await verifyHostingerSmtp({ host: smtp_host, port: smtp_port, secure: smtp_secure, user: email, pass: password });
  } catch (e) {
    logError('hostinger.verify_failed', e, { email });
    return NextResponse.json({ error: `SMTP verify failed: ${e instanceof Error ? e.message : 'Unknown'}` }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const row = {
    user_id: user.id,
    provider: 'hostinger', 
    google_email: email,
    display_name: 'Startup India Certificate', 
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

  const { data: existing } = await admin.from('sender_accounts').select('id').eq('provider', 'hostinger').eq('google_email', email).maybeSingle();

  if (existing) {
    await admin.from('sender_accounts').update(row).eq('id', existing.id);
  } else {
    await admin.from('sender_accounts').insert(row);
  }
  
  return NextResponse.json({ ok: true });
}
