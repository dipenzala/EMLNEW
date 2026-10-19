import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const user = await requireUser();
  const sb = createSupabaseServer();

  // 1. Basic Counts
  async function count(table: string, filter?: (q: any) => any) {
    let q: any = sb.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    if (filter) q = filter(q); 
    const { count } = await q; 
    return count ?? 0;
  }

  const [campaigns, queued, sent, failed, senders] = await Promise.all([
    count('campaigns'), 
    count('email_jobs', (q) => q.eq('status', 'queued')), 
    count('email_jobs', (q) => q.eq('status', 'accepted')),
    count('email_jobs', (q) => q.eq('status', 'failed')), 
    count('sender_accounts')
  ]);

  // 2. Fetch Senders to calculate limits
  const { data: senderData } = await sb.from('sender_accounts')
    .select('id, daily_cap, status, paused')
    .eq('user_id', user.id);

  const activeSenders = senderData?.filter(s => s.status === 'connected' && !s.paused) || [];
  const totalCapacity = activeSenders.reduce((sum, s) => sum + (s.daily_cap || 350), 0);

  // 3. Calculate Usage in last 24h
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: capUsed } = await sb.from('send_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('kind', ['reserved', 'accepted'])
    .gte('created_at', since);

  const used = capUsed ?? 0;
  const remaining = Math.max(0, totalCapacity - used);

  const globalEnabled = (process.env.GLOBAL_SENDING_ENABLED ?? 'false') === 'true';

  return NextResponse.json({ 
    campaigns, queued, sent, failed, 
    total_senders: senders, 
    active_senders: activeSenders.length,
    total_capacity: totalCapacity,
    used_today: used,
    remaining_today: remaining,
    global_enabled: globalEnabled 
  });
}
