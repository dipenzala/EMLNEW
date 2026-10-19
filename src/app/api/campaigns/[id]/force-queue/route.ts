import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const admin = createSupabaseAdmin();

    // 1. Fetch campaign to get sender ID
    const { data: campaign } = await admin.from('campaigns').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    // 2. Use our Database Function to enqueue all contacts (Bypasses JS limits)
    const { data: count, error } = await admin.rpc('enqueue_campaign_jobs_bulk', {
      p_campaign_id: params.id,
      p_user_id: user.id,
      p_sender_id: campaign.sender_account_id || null
    });

    if (error) {
      console.error("RPC Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Mark campaign as running
    await admin.from('campaigns').update({ status: 'running' }).eq('id', params.id);

    // 4. Trigger the background auto-send loop
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      fetch(`${appUrl}/api/drain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ userId: user.id, depth: 0 }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, totalEnqueued: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
