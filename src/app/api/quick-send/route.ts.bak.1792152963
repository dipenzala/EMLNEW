import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { sendViaSender } from '@/lib/mailer';
import { sanitizeUserHtml, toPlainText } from '@/lib/template';
import { log, logError } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';
import { emailSchema } from '@/lib/validation';

const schema = z.object({
  to: z.string().min(3).max(2000),
  sender_account_id: z.string().uuid().nullable().optional(),
  subject: z.string().min(1).max(300),
  html: z.string().max(500_000).default(''),
  text_body: z.string().max(500_000).default(''),
});

async function pickSender(admin: any, userId: string, preferred: string | null) {
  if (preferred) {
    const { data } = await admin.from('sender_accounts').select('id,google_email,display_name,status,paused').eq('id', preferred).eq('user_id', userId).maybeSingle();
    if (data && data.status === 'connected' && !data.paused) return data;
  }
  const { data: list } = await admin.from('sender_accounts')
    .select('id,google_email,display_name,status,paused,last_used_at')
    .eq('user_id', userId).eq('status', 'connected').eq('paused', false)
    .order('last_used_at', { ascending: true, nullsFirst: true }).limit(1);
  return list?.[0] ?? null;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!rateLimit(`quick-send:${user.id}`, 30, 60_000)) return NextResponse.json({ error: 'rate limited (30/min)' }, { status: 429 });
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
    return NextResponse.json({ error: 'Global sending is disabled. Set GLOBAL_SENDING_ENABLED=true in .env.local, restart the server, and toggle it in Settings.' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 });

  const rawList = parsed.data.to.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const emails: string[] = [];
  for (const e of rawList) {
    if (!emailSchema.safeParse(e).success) return NextResponse.json({ error: `Invalid email: ${e}` }, { status: 400 });
    emails.push(e);
  }
  if (emails.length === 0) return NextResponse.json({ error: 'No recipients' }, { status: 400 });
  if (emails.length > 50) return NextResponse.json({ error: 'Max 50 recipients per quick send' }, { status: 400 });

  const admin = createSupabaseAdmin();
  const sender = await pickSender(admin, user.id, parsed.data.sender_account_id ?? null);
  if (!sender) return NextResponse.json({ error: 'No connected sender. Go to Senders → Connect Google or Hostinger.' }, { status: 400 });

  const html = sanitizeUserHtml(parsed.data.html);
  const text = parsed.data.text_body?.trim() || toPlainText(html);
  const subject = parsed.data.subject;
  const from = `${sender.display_name || 'CertWinX'} <${sender.google_email}>`;

  const results: Array<{ to: string; ok: boolean; id?: string; error?: string }> = [];
  try {
    for (const to of emails) {
      try {
        const messageId = await Promise.race([
          sendViaSender(sender.id, { to, from, subject, html, text }),
          new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 25_000)),
        ]);
        results.push({ to, ok: true, id: messageId });
      } catch (e) { results.push({ to, ok: false, error: e instanceof Error ? e.message : String(e) }); }
    }
    await admin.from('sender_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', sender.id);
    await admin.from('audit_logs').insert({ user_id: user.id, action: 'quick_send', detail: { from: sender.google_email, recipients: emails, subject, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length } });
    log('quick_send.done', { userId: user.id, senderId: sender.id, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
    return NextResponse.json({ ok: true, from: sender.google_email, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
  } catch (e) {
    logError('quick_send.failed', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'send failed' }, { status: 500 });
  }
}
