import nodemailer from 'nodemailer';
import { createSupabaseAdmin } from './supabase/server';
import { decrypt } from './crypto';
import { google } from 'googleapis';

export async function sendViaSender(senderId: string, msg: any) {
  const admin = createSupabaseAdmin();
  const { data: sender } = await admin.from('sender_accounts').select('*').eq('id', senderId).single();
  if (!sender) throw new Error('Sender not found');

  msg.from = `Startup India Certificate <${sender.google_email}>`;

  // SMART ROUTING: If OAuth exists, use API. Else fallback to SMTP.
  if (sender.refresh_token_enc) {
    const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    client.setCredentials({ refresh_token: decrypt(sender.refresh_token_enc) });
    const gmail = google.gmail({ version: 'v1', auth: client });
    
    const encodedSubject = `=?UTF-8?B?${Buffer.from(msg.subject, 'utf8').toString('base64')}?=`;
    const str = [
      `To: ${msg.to}`, 
      `From: ${msg.from}`, 
      `Subject: ${encodedSubject}`, 
      'MIME-Version: 1.0', 
      'Content-Type: text/html; charset=UTF-8', 
      '', 
      msg.html
    ].join('\r\n');
    
    // Gmail API sends via HTTP (Allowed on Vercel)
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(str).toString('base64url') } });
    return res.data.id;
  } else if (sender.smtp_password_enc) {
    const pass = decrypt(sender.smtp_password_enc);
    const transport = nodemailer.createTransport({
      host: sender.smtp_host || 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: sender.smtp_user || sender.google_email, pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    
    // Force timeout in 5 seconds so Vercel doesn't hang
    const mailPromise = transport.sendMail({ from: msg.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP_CONNECTION_TIMEOUT')), 5000));
    
    const info: any = await Promise.race([mailPromise, timeoutPromise]);
    return info.messageId;
  } else {
    throw new Error('No credentials found for this sender.');
  }
}
