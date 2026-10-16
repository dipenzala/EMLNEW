import { google } from 'googleapis';
import { encrypt, decrypt } from './crypto';
import { createSupabaseAdmin } from './supabase/server';
export function oauthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!id || !secret || !redirect) throw new Error('Google OAuth env not configured');
  return new google.auth.OAuth2(id, secret, redirect);
}
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GMAIL_USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
export function buildAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [GMAIL_SEND_SCOPE, GMAIL_USERINFO_SCOPE], state, include_granted_scopes: true });
}
export async function exchangeCode(code: string) { return (await oauthClient().getToken(code)).tokens; }
export async function getAccessTokenForSender(senderId: string): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from('sender_accounts').select('*').eq('id', senderId).single();
  if (error || !data) throw new Error('Sender not found');
  if (data.status !== 'connected') throw new Error('Sender not connected');
  const refresh = data.refresh_token_enc ? decrypt(data.refresh_token_enc) : null;
  const access = data.access_token_enc ? decrypt(data.access_token_enc) : null;
  const expiry = data.token_expiry ? new Date(data.token_expiry).getTime() : 0;
  if (access && expiry > Date.now() + 60_000) return access;
  if (!refresh) throw new Error('No refresh token; reconnect required');
  const client = oauthClient();
  client.setCredentials({ refresh_token: refresh });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Failed to refresh access token');
  await admin.from('sender_accounts').update({ access_token_enc: encrypt(credentials.access_token), token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', senderId);
  return credentials.access_token;
}
export async function storeTokens(senderId: string, tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null; scope?: string | null; }) {
  const admin = createSupabaseAdmin();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (tokens.access_token) update.access_token_enc = encrypt(tokens.access_token);
  if (tokens.refresh_token) update.refresh_token_enc = encrypt(tokens.refresh_token);
  if (tokens.expiry_date) update.token_expiry = new Date(tokens.expiry_date).toISOString();
  if (tokens.scope) update.scopes = tokens.scope;
  const { error } = await admin.from('sender_accounts').update(update).eq('id', senderId);
  if (error) throw error;
}
export async function sendRawMessage(accessToken: string, raw: string): Promise<string> {
  const client = oauthClient();
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data.id ?? '';
}
export function buildRawMessage(opts: { to: string; from: string; subject: string; html: string; text: string; unsubscribeUrl?: string; listUnsubscribeMailto?: string; }): string {
  const boundary = 'cw-' + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${opts.from}`, `To: ${opts.to}`, `Subject: ${opts.subject.replace(/[\r\n]+/g, ' ')}`, 'MIME-Version: 1.0',
    opts.unsubscribeUrl ? `List-Unsubscribe: <${opts.unsubscribeUrl}>${opts.listUnsubscribeMailto ? `, <mailto:${opts.listUnsubscribeMailto}>` : ''}` : '',
    opts.unsubscribeUrl ? 'List-Unsubscribe-Post: List-Unsubscribe=One-Click' : '',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ].filter(Boolean).join('\r\n');
  const body = `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${opts.text}\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${opts.html}\r\n--${boundary}--`;
  return Buffer.from(`${headers}\r\n\r\n${body}`, 'utf8').toString('base64url');
}
