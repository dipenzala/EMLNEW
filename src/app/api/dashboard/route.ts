import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  // Calculate IST Midnight exactly
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(istTime.getTime() - istOffset).toISOString();

  const { count: campaigns } = await admin.from('campaigns').select('*', { count: 'exact', head: true });
  const { count: queued } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'queued');
  const { count: accepted } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'accepted');
  const { count: failed } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed');
  
  // Count Used Today from send_events (Correct IST logic)
  const { count: usedToday } = await admin.from('send_events').select('*', { count: 'exact', head: true }).eq('kind', 'accepted').gte('created_at', todayStart);

  const { data: senders } = await admin.from('sender_accounts').select('daily_cap, status, paused');
  const active = senders?.filter(s => s.status === 'connected' && !s.paused) || [];
  const totalCap = active.reduce((a, s) => a + (s.daily_cap || 350), 0);
  const used = usedToday || 0;

  return NextResponse.json({
    campaigns: campaigns || 0, queued: queued || 0, sent: accepted || 0, failed: failed || 0,
    total_senders: senders?.length || 0, active_senders: active.length,
    total_capacity: totalCap, used_today: used, remaining_today: Math.max(0, totalCap - used),
    global_enabled: true
  });
}
