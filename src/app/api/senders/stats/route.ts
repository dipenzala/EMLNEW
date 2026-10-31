import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(istTime.getTime() - istOffset).toISOString();

  const { data: senders } = await admin.from('sender_accounts').select('*').order('created_at', { ascending: false });
  if (!senders) return NextResponse.json({ senders: [], globalStats: {} });

  const { data: events } = await admin.from('send_events').select('sender_account_id').eq('kind', 'accepted').gte('created_at', todayStart);

  const statsMap: Record<string, { today: number }> = {};
  senders.forEach(s => { statsMap[s.id] = { today: 0 }; });

  events?.forEach(e => {
    if (e.sender_account_id && statsMap[e.sender_account_id]) {
      statsMap[e.sender_account_id].today++;
    }
  });

  const enrichedSenders = senders.map(s => ({ ...s, stats: statsMap[s.id] }));
  const globalStats = {
    totalSenders: senders.length,
    activeSenders: senders.filter(s => s.status === 'connected' && !s.paused).length,
    totalCapacity: senders.filter(s => s.status === 'connected' && !s.paused).reduce((acc, s) => acc + (s.daily_cap || 350), 0),
    usedToday: Object.values(statsMap).reduce((acc, s) => acc + s.today, 0),
  };

  return NextResponse.json({ senders: enrichedSenders, globalStats });
}
