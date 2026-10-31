import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

export async function POST() {
  try {
    await requireUser(); 
    const admin = createSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;

    // 1. AUTO-RETRY: Reset failed jobs (only those attempted less than 3 times)
    await admin.from('email_jobs')
      .update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null })
      .eq('status', 'failed')
      .lt('attempts', 3);

    // 2. Find ONLY 1 user with queued emails (to prevent timeout)
    const { data: queuedJob } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(1).maybeSingle();
    
    let totalSent = 0;
    let totalFailed = 0;

    if (queuedJob) {
      // Process only 10 emails for this user
      const result = await processBatch(queuedJob.user_id, 10);
      totalSent = result.sent;
      totalFailed = result.failed;

      // Trigger the continuous drain loop
      if (appUrl && secret) {
        fetch(`${appUrl}/api/drain`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
          body: JSON.stringify({ userId: queuedJob.user_id, depth: 0 }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, totalSent, totalFailed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
