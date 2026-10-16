import { createSupabaseAdmin } from './supabase/server';
import { sendViaSender } from './mailer';
import { renderTemplate, sanitizeUserHtml, toPlainText } from './template';
import { log, logError } from './logger';
import { randomToken } from './crypto';

export type ProcessResult = { claimed: number; sent: number; skipped: number; failed: number; uncertain: number };

async function isSuppressed(admin: any, userId: string, email: string) {
  const { data } = await admin.from('suppression_list').select('id').eq('user_id', userId).eq('email', email).maybeSingle();
  return !!data;
}

async function makeUnsubscribeUrl(admin: any, userId: string, contactId: string) {
  const token = randomToken(24);
  await admin.from('unsubscribe_tokens').insert({ token, user_id: userId, contact_id: contactId });
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/unsubscribe?token=${token}`;
}

async function pickAndReserveSender(admin: any, _userId: string, preferred: string | null, cap: number): Promise<string | null> {
  // Shared pool: no user filter.
  if (preferred) {
    const { data: pref } = await admin.from('sender_accounts')
      .select('id,status,paused').eq('id', preferred).maybeSingle();
    if (pref && pref.status === 'connected' && !pref.paused) {
      const { data: ok } = await admin.rpc('reserve_sender_capacity', { p_sender: pref.id, p_cap: cap });
      if (ok) return pref.id;
    }
  }
  const { data: senders } = await admin.from('sender_accounts')
    .select('id').eq('status', 'connected').eq('paused', false);
  if (!senders || senders.length === 0) return null;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const usage = await Promise.all(senders.map(async (s: { id: string }) => {
    const { count } = await admin.from('send_events')
      .select('id', { count: 'exact', head: true })
      .eq('sender_account_id', s.id)
      .in('kind', ['reserved', 'accepted'])
      .gte('created_at', since);
    return { id: s.id, used: count ?? 0 };
  }));
  usage.sort((a: any, b: any) => a.used - b.used);
  for (const s of usage) {
    if (s.used >= cap) continue;
    const { data: ok } = await admin.rpc('reserve_sender_capacity', { p_sender: s.id, p_cap: cap });
    if (ok) return s.id;
  }
  return null;
}

export async function processBatch(userId: string, limit: number): Promise<ProcessResult> {
  const admin = createSupabaseAdmin();
  const result: ProcessResult = { claimed: 0, sent: 0, skipped: 0, failed: 0, uncertain: 0 };
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') { log('processBatch.skipped_killswitch', { userId }); return result; }
  const { data: jobs, error } = await admin.rpc('claim_jobs', { p_user: userId, p_limit: limit });
  if (error) { logError('claim_jobs.failed', error, { userId }); throw error; }
  result.claimed = jobs?.length ?? 0;
  if (!jobs || jobs.length === 0) return result;
  for (const job of jobs) {
    try {
      const outcome = await processOne(admin, job);
      if (outcome === 'sent') result.sent++; else if (outcome === 'skipped') result.skipped++; else if (outcome === 'uncertain') result.uncertain++; else result.failed++;
    } catch (e) { logError('processOne.threw', e, { jobId: job.id }); result.failed++; }
  }
  return result;
}

async function processOne(admin: any, job: any): Promise<'sent' | 'failed' | 'skipped' | 'uncertain'> {
  const jobId = job.id as string; const userId = job.user_id as string; const to = job.to_email as string;
  if (await isSuppressed(admin, userId, to)) { await admin.from('email_jobs').update({ status: 'suppressed', last_error: 'suppressed', updated_at: new Date().toISOString() }).eq('id', jobId); return 'skipped'; }
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', job.campaign_id).single();
  if (!campaign || !['running', 'scheduled'].includes(campaign.status)) { await admin.from('email_jobs').update({ status: 'cancelled', last_error: 'campaign not running', updated_at: new Date().toISOString() }).eq('id', jobId); return 'skipped'; }
  const cap = Number(process.env.MAX_EMAILS_PER_SENDER_24H ?? 350);
  const preferred = (campaign.sender_account_id ?? job.sender_account_id) as string | null;
  const senderId = await pickAndReserveSender(admin, userId, preferred, cap);
  if (!senderId) { await admin.from('email_jobs').update({ status: 'queued', next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: 'no sender capacity', updated_at: new Date().toISOString() }).eq('id', jobId); return 'failed'; }
  await admin.from('email_jobs').update({ sender_account_id: senderId }).eq('id', jobId);
  const { data: sender } = await admin.from('sender_accounts').select('*').eq('id', senderId).single();
  if (!sender) { await admin.from('email_jobs').update({ status: 'failed', last_error: 'sender missing', updated_at: new Date().toISOString() }).eq('id', jobId); return 'failed'; }
  const { data: contact } = await admin.from('contacts').select('*').eq('id', job.contact_id).single();
  const tokens = { email: contact?.email ?? to, first_name: contact?.first_name ?? '', last_name: contact?.last_name ?? '', company_name: contact?.company_name ?? '' };
  const unsubUrl = await makeUnsubscribeUrl(admin, userId, job.contact_id as string);
  const html = sanitizeUserHtml(renderTemplate(campaign.html ?? '', tokens, { html: false }));
  const text = campaign.text_body?.trim() || toPlainText(html);
  const subject = renderTemplate(campaign.subject ?? '', tokens, { html: false });
  const from = `${sender.display_name || 'CertWinX'} <${sender.google_email}>`;
  try {
    const messageId = await Promise.race([
      sendViaSender(senderId, {
        to, from, subject, html, text,
        unsubscribeUrl: unsubUrl,
        listUnsubscribeMailto: sender.google_email,
      }),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 25_000)),
    ]);
    await admin.from('email_jobs').update({ status: 'accepted', message_id: messageId, accepted_at: new Date().toISOString(), lease_until: null, updated_at: new Date().toISOString() }).eq('id', jobId);
    await admin.from('send_events').insert({ user_id: userId, sender_account_id: senderId, job_id: jobId, kind: 'accepted' });
    await admin.from('sender_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', senderId);
    return 'sent';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e); const isTimeout = msg.includes('timeout'); const status = isTimeout ? 'uncertain' : 'failed';
    const backoffMs = Math.min(60_000 * Math.pow(2, (job.attempts as number) ?? 1), 30 * 60_000);
    await admin.from('email_jobs').update({ status, last_error: msg.slice(0, 400), lease_until: null, next_attempt_at: new Date(Date.now() + backoffMs).toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
    await admin.from('send_events').insert({ user_id: userId, sender_account_id: senderId, job_id: jobId, kind: status === 'uncertain' ? 'uncertain' : 'failed' });
    logError('send.failed', msg, { jobId, senderId });
    return isTimeout ? 'uncertain' : 'failed';
  }
}

export async function enqueueCampaignJobs(campaignId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaignId).single();
  if (!campaign) throw new Error('campaign not found');
  let q = admin.from('contacts').select('id,email,unsubscribed').eq('user_id', campaign.user_id);
  if (campaign.segment_tags?.length) q = q.overlaps('tags', campaign.segment_tags);
  const { data: contacts } = await q;
  if (!contacts?.length) return 0;
  const rows = contacts.filter((c: any) => !c.unsubscribed).map((c: any) => ({ campaign_id: campaignId, user_id: campaign.user_id, contact_id: c.id, sender_account_id: campaign.sender_account_id, to_email: c.email, status: 'queued' }));
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error, count } = await admin.from('email_jobs').upsert(rows.slice(i, i + 500), { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true, count: 'exact' });
    if (error) throw error; inserted += count ?? 0;
  }
  return inserted;
}
