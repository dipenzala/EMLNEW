import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';
import { log, logError } from '@/lib/logger';

const schema = z.object({ action: z.enum(['send_now']) });

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
    if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
      return NextResponse.json({ error: 'Global sending is disabled.' }, { status: 400 });
    }
    
    const { data: senders } = await sb.from('sender_accounts').select('id').eq('status', 'connected').eq('paused', false);
    if (!senders || senders.length === 0) return NextResponse.json({ error: 'No connected sender.' }, { status: 400 });
    
    await admin.from('campaigns').update({ status: 'running' }).eq('id', c.id).eq('user_id', user.id);
    
    // 🔥 USE RPC TO ENQUEUE ALL CONTACTS (Bypasses Vercel 1000 limit)
    const { data: enqueued, error: rpcError } = await admin.rpc('enqueue_campaign_jobs_bulk', {
      p_campaign_id: c.id,
      p_user_id: user.id,
      p_sender_id: c.sender_account_id || null
    });

    if (rpcError) {
      logError('campaign.enqueue_rpc_failed', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    log('campaign.send_now', { userId: user.id, campaignId: c.id, enqueued });
    
    // Trigger the drain chain in background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      fetch(`${appUrl}/api/drain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ userId: user.id, depth: 0 }),
      }).catch(() => {});
    }
    
    return NextResponse.json({ ok: true, enqueued: enqueued || 0 });
  }
  
  return NextResponse.json({ error: 'unsupported' }, { status: 400 });
}
