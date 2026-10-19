import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { subDays, startOfDay, startOfWeek, startOfMonth } from 'date-fns';

export async function GET() {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  // Time boundaries (using server time, close enough for stats)
  const now = new Date();
  const startToday = startOfDay(now).toISOString();
  const startWeek = startOfWeek(now).toISOString();
  const startMonth = startOfMonth(now).toISOString();

  // 1. Fetch all senders
  const { data: senders, error: sErr } = await admin
    .from('sender_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // 2. Fetch all accepted jobs (for calculating usage)
  const { data: jobs } = await admin
    .from('email_jobs')
    .select('sender_account_id, accepted_at')
    .eq('user_id', user.id)
    .eq('status', 'accepted');

  // 3. Aggregate stats in memory
  const statsMap: Record<string, { total: number, today: number, week: number, month: number }> = {};
  
  senders?.forEach(s => {
    statsMap[s.id] = { total: 0, today: 0, week: 0, month: 0 };
  });

  jobs?.forEach(j => {
    if (!j.sender_account_id || !j.accepted_at) return;
    const sId = j.sender_account_id;
    if (!statsMap[sId]) return; // Job belongs to deleted sender

    statsMap[sId].total++;
    if (j.accepted_at >= startToday) statsMap[sId].today++;
    if (j.accepted_at >= startWeek) statsMap[sId].week++;
    if (j.accepted_at >= startMonth) statsMap[sId].month++;
  });

  // 4. Combine senders with their stats
  const enrichedSenders = senders.map(s => ({
    ...s,
    stats: statsMap[s.id] || { total: 0, today: 0, week: 0, month: 0 }
  }));

  // 5. Global totals
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
