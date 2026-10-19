import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // Disables Vercel caching

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  // Fetch ALL senders globally
  const { data: senders, error: sErr } = await admin.from('sender_accounts').select('*').order('created_at', { ascending: false });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Fetch ALL accepted jobs globally
  const { data: jobs } = await admin.from('email_jobs').select('sender_account_id, accepted_at').eq('status', 'accepted');

  const statsMap: Record<string, { total: number, today: number, week: number, month: number }> = {};
  senders?.forEach(s => { statsMap[s.id] = { total: 0, today: 0, week: 0, month: 0 }; });

  jobs?.forEach(j => {
    if (!j.sender_account_id || !j.accepted_at) return;
    const sId = j.sender_account_id;
    if (!statsMap[sId]) return;

    statsMap[sId].total++;
    if (j.accepted_at >= since24h) statsMap[sId].today++;
    if (j.accepted_at >= since7d) statsMap[sId].week++;
    if (j.accepted_at >= since30d) statsMap[sId].month++;
  });

  const enrichedSenders = senders.map(s => ({ ...s, stats: statsMap[s.id] || { total: 0, today: 0, week: 0, month: 0 } }));

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
