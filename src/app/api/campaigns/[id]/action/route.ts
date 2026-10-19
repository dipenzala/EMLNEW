import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { log } from '@/lib/logger';

const schema = z.object({ action: z.enum(['send_now', 'stop']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  
  const sb = createSupabaseServer();
  const admin = createSupabaseAdmin();
  const { data: c } = await sb.from('campaigns').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (parsed.data.action === 'send_now') {
    if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return NextResponse.json({ error: 'Global sending disabled.' }, { status: 400 });
    await admin.from('campaigns').update({ status: 'running' }).eq('id', c.id);
    
    // Enqueue via RPC
    const { data: enqueued, error: rpcError } = await admin.rpc('enqueue_campaign_jobs_bulk', {
      p_campaign_id: c.id, p_user_id: user.id, p_sender_id: c.sender_account_id || null
    });
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

    // Trigger drain
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      fetch(`${appUrl}/api/drain`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, body: JSON.stringify({ userId: user.id }) }).catch(() => {});
    }
    return NextResponse.json({ ok: true, enqueued });
  }

  if (parsed.data.action === 'stop') {
    // 1. Mark campaign as paused
    await admin.from('campaigns').update({ status: 'paused' }).eq('id', c.id);
    // 2. Cancel all pending jobs for this campaign
    await admin.from('email_jobs').update({ status: 'cancelled' }).eq('campaign_id', c.id).eq('status', 'queued');
    
    log('campaign.stopped', { userId: user.id, campaignId: c.id });
    return NextResponse.json({ ok: true });
  }
  
  return NextResponse.json({ error: 'unsupported' }, { status: 400 });
}
