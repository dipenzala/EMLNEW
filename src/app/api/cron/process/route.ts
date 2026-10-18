import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch, enqueueCampaignJobs } from '@/lib/queue';
import { log } from '@/lib/logger';
import { timingSafeEq } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return provided.length > 0 && timingSafeEq(provided, secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return NextResponse.json({ ok: true, skipped: 'killswitch' });

  const admin = createSupabaseAdmin();

  // 1. Start scheduled campaigns that are due
  const { data: dueCampaigns } = await admin
    .from('campaigns')
    .select('id,user_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(5);

  if (dueCampaigns && dueCampaigns.length > 0) {
    for (const c of dueCampaigns) {
      await admin.from('campaigns').update({ status: 'running' }).eq('id', c.id);
      await enqueueCampaignJobs(c.id);
      log('cron.campaign.started', { campaignId: c.id });
    }
  }

  // 2. Process queue
  const { data: profiles } = await admin.from('profiles').select('id,batch_size,global_sending_enabled').eq('global_sending_enabled', true).limit(25);
  let claimed = 0, sent = 0, failed = 0;
  
  for (const p of profiles ?? []) {
    const limit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), p.batch_size ?? 5);
    try {
      const r = await processBatch(p.id, limit);
      claimed += r.claimed;
      sent += r.sent;
      failed += r.failed;
    } catch (e) {}
  }

  return NextResponse.json({ ok: true, claimed, sent, failed, campaigns_started: dueCampaigns?.length ?? 0 });
}
