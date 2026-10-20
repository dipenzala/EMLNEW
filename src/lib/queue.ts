import { createSupabaseAdmin } from './supabase/server';
import { sendViaSender } from './mailer';
import { renderTemplate, sanitizeUserHtml, toPlainText } from './template';
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
  if (preferred) {
    const { data: pref } = await admin.from('sender_accounts').select('id,status,paused').eq('id', preferred).maybeSingle();
    if (pref && pref.status === 'connected' && !pref.paused) {
      const { data: ok } = await admin.rpc('reserve_sender_capacity', { p_sender: pref.id, p_cap: cap });
      if (ok) return pref.id;
    }
  }
  const { data: senders } = await admin.from('sender_accounts').select('id').eq('status', 'connected').eq('paused', false);
  if (!senders || senders.length === 0) return null;
  
  const usage = await Promise.all(senders.map(async (s: { id: string }) => {
    const { count } = await admin.from('send_events')
      .select('id', { count: 'exact', head: true })
      .eq('sender_account_id', s.id)
      .in('kind', ['reserved', 'accepted'])
      .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()); 
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
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return result;
  
  const { data: jobs, error } = await admin.rpc('claim_jobs', { p_user: userId, p_limit: limit });
  if (error) throw error;
  
  result.claimed = jobs?.length ?? 0;
  if (!jobs || jobs.length === 0) return result;

  // 🚀 20x CONCURRENCY 🚀
  const CONCURRENCY = 20; 
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const chunk = jobs.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.allSettled(chunk.map((job: any) => processOne(admin, job)));
    
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value === 'sent') result.sent++;
        else if (outcome.value === 'skipped') result.skipped++;
        else if (outcome.value === 'uncertain') result.uncertain++;
        else result.failed++;
      } else {
        result.failed++;
      }
    }
  }
  return result;
}

async function processOne(admin: any, job: any): Promise<'sent' | 'failed' | 'skipped' | 'uncertain'> {
  const jobId = job.id as string; const userId = job.user_id as string; const to = job.to_email as string;
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', job.campaign_id).single();
  if (!campaign || !['running', 'scheduled'].includes(campaign.status)) {
    await admin.from('email_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', jobId); 
    return 'skipped'; 
  }
  
  const cap = Number(process.env.MAX_EMAILS_PER_SENDER_24H ?? 350);
  const senderId = await pickAndReserveSender(admin, userId, campaign.sender_account_id ?? null, cap);
  if (!senderId) { 
    await admin.from('email_jobs').update({ status: 'queued', next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId); 
    return 'failed'; 
  }
  await admin.from('email_jobs').update({ sender_account_id: senderId }).eq('id', jobId);
  
  const { data: sender } = await admin.from('sender_accounts').select('*').eq('id', senderId).single();
  const { data: contact } = await admin.from('contacts').select('*').eq('id', job.contact_id).single();
  
  const tokens = { email: contact?.email ?? to, first_name: contact?.first_name ?? '' };
  const unsubUrl = await makeUnsubscribeUrl(admin, userId, job.contact_id as string);
  
  let html = sanitizeUserHtml(renderTemplate(campaign.html ?? '', tokens, { html: false }));
  const text = toPlainText(html);
  const subject = renderTemplate(campaign.subject ?? '', tokens, { html: false });

  const from = `Startup India Certificate <${sender.google_email}>`;
  try {
    const messageId = await Promise.race([
      sendViaSender(senderId, { to, from, subject, html, text, unsubscribeUrl: unsubUrl }),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
    ]);
    
    await admin.from('email_jobs').update({ status: 'accepted', message_id: messageId, updated_at: new Date().toISOString() }).eq('id', jobId);
    await admin.from('send_events').insert({ user_id: userId, sender_account_id: senderId, job_id: jobId, kind: 'accepted' });
    await admin.from('sender_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', senderId);
    return 'sent';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes('timeout');
    const status = isTimeout ? 'uncertain' : 'failed';
    await admin.from('email_jobs').update({ status, last_error: msg.slice(0, 400), lease_until: null, updated_at: new Date().toISOString() }).eq('id', jobId);
    return isTimeout ? 'uncertain' : 'failed';
  }
}

export async function enqueueCampaignJobs(campaignId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaignId).single();
  if (!campaign) throw new Error('campaign not found');
  const { data: count, error } = await admin.rpc('enqueue_campaign_jobs_bulk', {
    p_campaign_id: campaignId, p_user_id: campaign.user_id, p_sender_id: campaign.sender_account_id || null,
  });
  if (error) throw error;
  return count || 0;
}
