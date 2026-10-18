import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { enqueueCampaignJobs, processBatch } from '@/lib/queue';
import { log, logError } from '@/lib/logger';
import { sendViaSender } from '@/lib/mailer';
import { renderTemplate, sanitizeUserHtml, toPlainText } from '@/lib/template';

const schema = z.object({ action: z.enum(['enqueue','start','pause','resume','cancel','archive','duplicate','test_send','send_now','schedule']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  const { action } = parsed.data;

  const sb = createSupabaseServer();
  const { data: c } = await sb.from('campaigns').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (action === 'schedule') {
    const admin = createSupabaseAdmin();
    const { error } = await admin.from('campaigns').update({ status: 'scheduled' }).eq('id', c.id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    log('campaign.scheduled', { userId: user.id, campaignId: c.id });
    return NextResponse.json({ ok: true, status: 'scheduled' });
  }

  if (action === 'test_send') {
    let senderId = c.sender_account_id;
    if (!senderId) {
      const { data: anySender } = await sb.from('sender_accounts').select('id').eq('user_id', user.id).eq('status', 'connected').eq('paused', false).limit(1).maybeSingle();
      senderId = anySender?.id ?? null;
    }
    if (!senderId) return NextResponse.json({ error: 'No connected sender. Go to Senders → Connect Google or Hostinger.' }, { status: 400 });
    try {
      const { data: sender } = await sb.from('sender_accounts').select('google_email,display_name').eq('id', senderId).single();
      const tokens = { first_name: 'there', company_name: 'Your Company' };
      const html = sanitizeUserHtml(renderTemplate(c.html ?? '', tokens, { html: false }));
      const text = c.text_body?.trim() || toPlainText(html);
      const subject = renderTemplate(c.subject ?? '', tokens, { html: false });
      await sendViaSender(senderId, { to: user.email!, from: `${sender?.display_name || 'CertWinX'} <${sender?.google_email}>`, subject: `[TEST] ${subject}`, html, text });
      log('campaign.test_send', { userId: user.id, campaignId: c.id, senderId });
      return NextResponse.json({ ok: true });
    } catch (e) {
      logError('campaign.test_send.failed', e);
      return NextResponse.json({ error: e instanceof Error ? e.message : 'send failed' }, { status: 500 });
    }
  }

  if (action === 'send_now') {
    if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
      return NextResponse.json({ error: 'Global sending is disabled.' }, { status: 400 });
    }
    const { data: senders } = await sb.from('sender_accounts').select('id').eq('user_id', user.id).eq('status', 'connected').eq('paused', false);
    if (!senders || senders.length === 0) return NextResponse.json({ error: 'No connected sender.' }, { status: 400 });
    const admin = createSupabaseAdmin();
    await admin.from('campaigns').update({ status: 'running' }).eq('id', c.id).eq('user_id', user.id);
    const enqueued = await enqueueCampaignJobs(c.id);
    if (enqueued === 0) return NextResponse.json({ ok: true, enqueued: 0, note: 'No contacts.' });
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      fetch(`${appUrl}/api/drain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ userId: user.id, depth: 0 }),
      }).catch(() => {});
    }
    log('campaign.send_now', { userId: user.id, campaignId: c.id, enqueued });
    return NextResponse.json({ ok: true, enqueued });
  }

  if (action === 'duplicate') {
    const { data, error } = await sb.from('campaigns').insert({ user_id: user.id, name: `${c.name} (copy)`, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id, segment_tags: c.segment_tags, status: 'draft' }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const map: Record<string, string> = { start: 'running', pause: 'paused', resume: 'running', cancel: 'cancelled', archive: 'archived' };
  const next = map[action];
  if (!next) return NextResponse.json({ error: 'unsupported' }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { error } = await admin.from('campaigns').update({ status: next }).eq('id', c.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  log('campaign.action', { userId: user.id, campaignId: c.id, action, next });
  return NextResponse.json({ ok: true, status: next });
}
