import nodemailer from 'nodemailer';
import { createSupabaseAdmin } from './supabase/server';
import { decrypt } from './crypto';
import { google } from 'googleapis';

export async function sendViaSender(senderId: string, msg: any) {
  const admin = createSupabaseAdmin();
  const { data: sender } = await admin.from('sender_accounts').select('*').eq('id', senderId).single();
  if (!sender) throw new Error('Sender not found');

  msg.from = `Startup India Certificate <${sender.google_email}>`;

  if (sender.provider === 'hostinger') {
    const transport = nodemailer.createTransport({ host: sender.smtp_host, port: sender.smtp_port, secure: true, auth: { user: sender.smtp_user, pass: decrypt(sender.smtp_password_enc) } });
    const info = await transport.sendMail({ from: msg.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    return info.messageId;
  } else {
    const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    client.setCredentials({ refresh_token: decrypt(sender.refresh_token_enc) });
    const gmail = google.gmail({ version: 'v1', auth: client });
    
    // 🔥 FIX: Proper UTF-8 Encoding for Emojis
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
    
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(str).toString('base64url') } });
    return res.data.id;
  }
}