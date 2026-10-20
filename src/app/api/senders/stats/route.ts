import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();

  const { data: senders } = await admin.from('sender_accounts').select('*').order('created_at', { ascending: false });
  if (!senders) return NextResponse.json({ senders: [], globalStats: {} });

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const { data: events } = await admin.from('send_events').select('sender_account_id, created_at').in('kind', ['reserved', 'accepted']);

  const statsMap: Record<string, { total: number, today: number, week: number, month: number }> = {};
  senders.forEach(s => { statsMap[s.id] = { total: 0, today: 0, week: 0, month: 0 }; });

  events?.forEach(e => {
    if (!e.sender_account_id || !statsMap[e.sender_account_id]) return;
    statsMap[e.sender_account_id].total++;
    if (e.created_at >= since24h) statsMap[e.sender_account_id].today++;
    if (e.created_at >= since7d) statsMap[e.sender_account_id].week++;
    if (e.created_at >= since30d) statsMap[e.sender_account_id].month++;
  });

  const enrichedSenders = senders.map(s => ({ ...s, stats: statsMap[s.id] }));
  
  const globalStats = {
    totalSenders: senders.length,
    activeSenders: senders.filter(s => s.status === 'connected' && !s.paused).length,
    totalCapacity: senders.filter(s => s.status === 'connected' && !s.paused).reduce((acc, s) => acc + (s.daily_cap || 350), 0),
    usedToday: Object.values(statsMap).reduce((acc, s) => acc + s.today, 0),
    usedWeek: Object.values(statsMap).reduce((acc, s) => acc + s.week, 0),
    usedMonth: Object.values(statsMap).reduce((acc, s) => acc + s.month, 0),
    usedTotal: Object.values(statsMap).reduce((acc, s) => acc + s.total, 0),
  };

  return NextResponse.json({ senders: enrichedSenders, globalStats });
}
