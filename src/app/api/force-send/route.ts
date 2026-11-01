import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const admin = createSupabaseAdmin();
    
    // 1. FORCE RESET: Unstick any processing/failed emails immediately
    await admin.from('email_jobs')
      .update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null, attempts: 0 })
      .in('status', ['processing', 'failed']);

    // 2. Find all users with queued emails
    const { data: queuedJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(100);
    const uniqueUsers = [...new Set(queuedJobs?.map(j => j.user_id) || [])];

    let totalSent = 0;
    let totalFailed = 0;

    // 3. Process 20 emails for each user immediately
    for (const userId of uniqueUsers) {
      const result = await processBatch(userId, 20);
      totalSent += (result.sent || 0);
      totalFailed += (result.failed || 0);
    }

    return NextResponse.json({ ok: true, totalSent, totalFailed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
