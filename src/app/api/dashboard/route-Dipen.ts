import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();

  const { count: campaigns } = await admin.from('campaigns').select('*', { count: 'exact', head: true });
  const { count: queued } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'queued');
  const { count: accepted } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'accepted');
  const { count: failed } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed');
  
  // 🔥 FIX: Used today is exactly the number of accepted jobs today
  const { count: usedToday } = await admin.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'accepted').gte('accepted_at', todayStart);

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
