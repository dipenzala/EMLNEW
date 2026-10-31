import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const admin = createSupabaseAdmin();
    
    const { data: campaign } = await admin.from('campaigns').select('*').eq('id', params.id).eq('user_id', user.id).single();
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    // 🔥 CALL RPC: This now handles everything (resets stuck jobs, queues new ones)
    const { data: count, error } = await admin.rpc('enqueue_campaign_jobs_bulk', {
      p_campaign_id: params.id, 
      p_user_id: user.id, 
      p_sender_id: campaign.sender_account_id || null
    });

    if (error) {
      console.error("RPC Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await admin.from('campaigns').update({ status: 'running' }).eq('id', params.id);

    return NextResponse.json({ ok: true, totalEnqueued: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
