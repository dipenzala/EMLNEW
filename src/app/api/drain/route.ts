import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId;
    const depth = body.depth || 0;
    
    if (!userId || depth > 50) return NextResponse.json({ ok: true, note: 'stopped' });

    // Process small batch of 10 emails to avoid timeout
    const result = await processBatch(userId, 10);

    // Check if there are more queued emails
    const admin = createSupabaseAdmin();
    const { count } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'queued');

    // If more emails exist, trigger next batch in background
    if (count && count > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const secret = process.env.CRON_SECRET;
      if (appUrl && secret) {
        fetch(`${appUrl}/api/drain`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
          body: JSON.stringify({ userId, depth: depth + 1 }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, processed: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
