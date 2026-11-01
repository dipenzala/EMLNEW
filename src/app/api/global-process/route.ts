import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const admin = createSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;

    await admin.rpc('reset_stuck_jobs');
    await admin.from('email_jobs').update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null }).eq('status', 'failed').lt('attempts', 3);

    const { data: queuedJobs } = await admin.from('email_jobs').select('user_id').eq('status', 'queued').limit(100);
    const uniqueUsers = [...new Set(queuedJobs?.map(j => j.user_id) || [])];

    if (appUrl && secret) {
      uniqueUsers.forEach(userId => {
        fetch(`${appUrl}/api/drain`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
          body: JSON.stringify({ userId, depth: 0 }),
        }).catch(() => {});
      });
    }

    return NextResponse.json({ ok: true, totalSent: 0, totalFailed: 0, message: 'Triggered background' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
