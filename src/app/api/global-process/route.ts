import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const admin = createSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;

    // 1. Reset stuck jobs (Processing > 5 mins)
    await admin.rpc('reset_stuck_jobs');

    // 2. Auto-Retry failed emails (max 3 attempts)
    await admin.from('email_jobs').update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null }).eq('status', 'failed').lt('attempts', 3);

    // 3. Find users with queued emails
    const { data: queuedJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(100);
    const uniqueUsers = [...new Set(queuedJobs?.map(j => j.user_id) || [])];

    // 4. 🔥 FIRE AND FORGET: Trigger background loops instantly and return
    if (appUrl && secret) {
      uniqueUsers.forEach(userId => {
        fetch(`${appUrl}/api/drain`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
          body: JSON.stringify({ userId, depth: 0 }),
        }).catch(() => {});
      });
    }

    // 5. Return response in 1 second so Cron-job.org never times out
    return NextResponse.json({ ok: true, message: `Triggered background processing for ${uniqueUsers.length} users.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
