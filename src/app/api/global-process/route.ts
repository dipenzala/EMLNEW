import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const admin = createSupabaseAdmin();
    
    // 1. Only reset stuck processing jobs (NOT failed jobs)
    await admin.rpc('reset_stuck_jobs');

    // 2. Find users with queued emails
    const { data: queuedJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(100);
    const uniqueUsers = [...new Set(queuedJobs?.map(j => j.user_id) || [])];

    let totalSent = 0;
    let totalFailed = 0;

    // 3. 🔥 SYNCHRONOUS PROCESSING: Process 10 emails directly (takes ~5-10 secs, no timeout)
    for (const userId of uniqueUsers) {
      const result = await processBatch(userId, 10);
      totalSent += (result.sent || 0);
      totalFailed += (result.failed || 0);
    }

    return NextResponse.json({ ok: true, totalSent, totalFailed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
