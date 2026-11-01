import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { oauthClient } from '@/lib/gmail';
import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const user = await requireUser();
    const admin = createSupabaseAdmin();
    const { data: senders } = await admin.from('sender_accounts').select('*').eq('user_id', user.id);

    if (!senders) return NextResponse.json({ error: 'No senders' }, { status: 400 });

    let working = 0;
    let failed = 0;
    let failedList = [];

    for (const sender of senders) {
      try {
        if (sender.provider === 'gmail' && sender.refresh_token_enc) {
          // Test Gmail OAuth
          const client = oauthClient();
          client.setCredentials({ refresh_token: decrypt(sender.refresh_token_enc) });
          await client.getAccessToken(); // Throws if invalid
        } else if (sender.provider === 'hostinger' && sender.smtp_password_enc) {
          // Test Hostinger SMTP
          const transport = nodemailer.createTransport({
            host: sender.smtp_host, port: sender.smtp_port, secure: true,
            auth: { user: sender.smtp_user, pass: decrypt(sender.smtp_password_enc) }
          });
          await transport.verify();
        }
        working++;
        await admin.from('sender_accounts').update({ status: 'connected', last_error: null }).eq('id', sender.id);
      } catch (e: any) {
        failed++;
        failedList.push(sender.google_email);
        const errorMsg = e.message || 'Connection failed';
        await admin.from('sender_accounts').update({ status: 'error', last_error: errorMsg }).eq('id', sender.id);
      }
    }

    return NextResponse.json({ ok: true, working, failed, failedList });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
