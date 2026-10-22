import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();

  const { data: senders } = await admin.from('sender_accounts').select('*').order('created_at', { ascending: false });
  if (!senders) return NextResponse.json({ senders: [], globalStats: {} });

  // Fetch accepted jobs today to calculate accurate usage per sender
  const { data: jobs } = await admin.from('email_jobs')
    .select('sender_account_id')
    .eq('status', 'accepted')
    .gte('accepted_at', todayStart);

  const statsMap: Record<string, { today: number }> = {};
  senders.forEach(s => { statsMap[s.id] = { today: 0 }; });

  jobs?.forEach(j => {
    if (j.sender_account_id && statsMap[j.sender_account_id]) {
      statsMap[j.sender_account_id].today++;
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
