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
  const { data: dueCampaigns } = await admin.from('campaigns').select('id,user_id').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()).limit(5);
  if (dueCampaigns) {
    for (const c of dueCampaigns) {
      await admin.from('campaigns').update({ status: 'running' }).eq('id', c.id);
      await enqueueCampaignJobs(c.id);
    }
  }

  // 2. Find all users with pending queued jobs and trigger the self-draining chain
  const { data: pendingJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(100);
  const userIds = Array.from(new Set(pendingJobs?.map(j => j.user_id) || []));
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;

  // Trigger /api/drain for each user with pending emails
  if (appUrl && secret) {
    for (const userId of userIds) {
      fetch(`${appUrl}/api/drain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ userId, depth: 0 }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, triggered_users: userIds.length });
}
