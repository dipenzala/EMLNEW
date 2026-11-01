import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const admin = createSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;

    // 1. Auto-Retry failed emails
    await admin.from('email_jobs').update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null }).eq('status', 'failed').lt('attempts', 3);

    // 2. Find all users with queued emails
    const { data: queuedJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(100);
    const uniqueUsers = [...new Set(queuedJobs?.map(j => j.user_id) || [])];

    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of uniqueUsers) {
      const result = await processBatch(userId, 100);
      totalSent += result.sent;
      totalFailed += result.failed;

      // Trigger the background drain chain (survives tab close)
      if (appUrl && secret) {
        fetch(`${appUrl}/api/drain`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
          body: JSON.stringify({ userId, depth: 0 }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, usersProcessed: uniqueUsers.length, totalSent, totalFailed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 