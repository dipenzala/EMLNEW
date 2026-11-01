import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const admin = createSupabaseAdmin();
    
    // Force reset any stuck/failed emails
    await admin.from('email_jobs')
      .update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null, attempts: 0 })
      .in('status', ['processing', 'failed']);

    const { data: queuedJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(10);
    const uniqueUsers = [...new Set(queuedJobs?.map(j => j.user_id) || [])];

    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of uniqueUsers) {
      // 🔥 PROCESS ONLY 5 EMAILS PER CLICK (Takes ~5 seconds, safe from 10s timeout)
      const result = await processBatch(userId, 5);
      totalSent += (result.sent || 0);
      totalFailed += (result.failed || 0);
    }

    return NextResponse.json({ ok: true, totalSent, totalFailed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
