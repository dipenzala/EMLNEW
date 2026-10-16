import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
export async function GET() {
  const user = await requireUser(); const sb = createSupabaseServer();
  async function count(table: string, filter?: (q: any) => any) {
    let q: any = sb.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    if (filter) q = filter(q); const { count } = await q; return count ?? 0;
  }
  const [campaigns, queued, sent, failed, uncertain, suppressed, unsubscribed, senders, sendersConnected] = await Promise.all([
    count('campaigns'), count('email_jobs', (q) => q.eq('status', 'queued')), count('email_jobs', (q) => q.eq('status', 'accepted')),
    count('email_jobs', (q) => q.eq('status', 'failed')), count('email_jobs', (q) => q.eq('status', 'uncertain')),
    count('email_jobs', (q) => q.eq('status', 'suppressed')), count('contacts', (q) => q.eq('unsubscribed', true)),
    count('sender_accounts'), count('sender_accounts', (q) => q.eq('status', 'connected')),
  ]);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: capUsed } = await sb.from('send_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('kind', ['reserved', 'accepted']).gte('created_at', since);
  const capTotal = (sendersConnected || 1) * Number(process.env.MAX_EMAILS_PER_SENDER_24H ?? 350);
  const globalEnabled = (process.env.GLOBAL_SENDING_ENABLED ?? 'false') === 'true';
  return NextResponse.json({ campaigns, queued, sent, failed, uncertain, suppressed, unsubscribed, senders, senders_connected: sendersConnected, cap_used: capUsed ?? 0, cap_total: capTotal, global_enabled: globalEnabled });
}
