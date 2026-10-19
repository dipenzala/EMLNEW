import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // Disables Vercel caching

export async function GET() {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  // 1. Per-User Counts (Campaigns & Jobs)
  const { count: campaigns } = await admin.from('campaigns').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  const { count: queued } = await admin.from('email_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'queued');
  const { count: sent } = await admin.from('email_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'accepted');
  const { count: failed } = await admin.from('email_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'failed');

  // 2. Shared Sender Capacity (Fetch ALL senders globally)
  const { data: senders } = await admin.from('sender_accounts').select('id, daily_cap, status, paused');
  const activeSenders = senders?.filter(s => s.status === 'connected' && !s.paused) || [];
  const totalCapacity = activeSenders.reduce((sum, s) => sum + (s.daily_cap || 350), 0);

  // 3. Global Usage (Rolling 24 hours)
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: usedToday } = await admin
    .from('send_events')
    .select('id', { count: 'exact', head: true })
    .in('kind', ['reserved', 'accepted'])
    .gte('created_at', since);

  const used = usedToday ?? 0;
  const remaining = Math.max(0, totalCapacity - used);

  return NextResponse.json({ 
    campaigns: campaigns ?? 0, 
    queued: queued ?? 0, 
    sent: sent ?? 0, 
    failed: failed ?? 0, 
    total_senders: senders?.length || 0, 
    active_senders: activeSenders.length,
    total_capacity: totalCapacity,
    used_today: used,
    remaining_today: remaining,
    global_enabled: (process.env.GLOBAL_SENDING_ENABLED ?? 'false') === 'true'
  });
}
