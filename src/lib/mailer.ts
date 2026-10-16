import nodemailer from 'nodemailer';
import { createSupabaseAdmin } from './supabase/server';
import { getAccessTokenForSender, sendRawMessage, buildRawMessage } from './gmail';
import { decrypt } from './crypto';

const FORCED_FROM_NAME = 'Startup India Certificate';

export type ProviderMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
  listUnsubscribeMailto?: string;
};

/** Provider-agnostic sender. Dispatches to Gmail API or Hostinger SMTP. */
export async function sendViaSender(senderId: string, msg: ProviderMessage): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data: sender, error } = await admin.from('sender_accounts').select('*').eq('id', senderId).single();
  if (error || !sender) throw new Error('Sender not found');
  if (sender.status !== 'connected') throw new Error('Sender not connected');
  if (sender.paused) throw new Error('Sender paused');

  // Force display name — every email goes out as "Startup India Certificate"
  const emailMatch = msg.from.match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1] : sender.google_email;
  const forcedMsg = { ...msg, from: `${FORCED_FROM_NAME} <${senderEmail}>` };

  if (sender.provider === 'hostinger') return sendViaHostinger(sender, forcedMsg);
  return sendViaGmail(senderId, forcedMsg);
}

async function sendViaGmail(senderId: string, msg: ProviderMessage): Promise<string> {
  const access = await getAccessTokenForSender(senderId);
  const raw = buildRawMessage(msg);
  return sendRawMessage(access, raw);
}

async function sendViaHostinger(sender: any, msg: ProviderMessage): Promise<string> {
  if (!sender.smtp_password_enc) throw new Error('Hostinger sender missing SMTP password');
  const pass = decrypt(sender.smtp_password_enc);
  const transport = nodemailer.createTransport({
    host: sender.smtp_host || 'smtp.hostinger.com',
    port: sender.smtp_port ?? 465,
    secure: sender.smtp_secure !== false,
    auth: { user: sender.smtp_user || sender.google_email, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });

  const headers: Record<string, string> = {};
  if (msg.unsubscribeUrl) {
    headers['List-Unsubscribe'] =
      `<${msg.unsubscribeUrl}>${msg.listUnsubscribeMailto ? `, <mailto:${msg.listUnsubscribeMailto}>` : ''}`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  try {
    const info = await transport.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      headers,
    });
    return info.messageId || '';
  } finally {
    transport.close();
  }
}

/** Verify Hostinger SMTP credentials by opening a real connection. */
export async function verifyHostingerSmtp(opts: {
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
}): Promise<void> {
  const transport = nodemailer.createTransport({
    host: opts.host || 'smtp.hostinger.com',
    port: opts.port ?? 465,
    secure: opts.secure !== false,
    auth: { user: opts.user, pass: opts.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}
