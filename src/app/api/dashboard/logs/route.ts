import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();

  const { data: jobs } = await admin
    .from('email_jobs')
    .select('id, campaign_id, to_email, status, created_at, sender_account_id')
    .in('status', ['accepted', 'failed', 'uncertain'])
    .not('to_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!jobs) return NextResponse.json([]);

  // Fetch senders
  const senderIds = [...new Set(jobs.map(j => j.sender_account_id).filter(Boolean))];
  const { data: senders } = await admin.from('sender_accounts').select('id, google_email').in('id', senderIds);
  const senderMap = new Map(senders?.map(s => [s.id, s.google_email]) || []);

  // Fetch campaigns
  const campaignIds = [...new Set(jobs.map(j => j.campaign_id).filter(Boolean))];
  const { data: campaigns } = await admin.from('campaigns').select('id, name').in('id', campaignIds);
  const campaignMap = new Map(campaigns?.map(c => [c.id, c.name]) || []);

  return NextResponse.json(jobs.map(j => ({
    id: j.id, 
    to_email: j.to_email, 
    status: j.status, 
    created_at: j.created_at,
    sender_email: j.sender_account_id ? (senderMap.get(j.sender_account_id) || 'Deleted') : 'Auto',
    campaign_name: j.campaign_id ? (campaignMap.get(j.campaign_id) || 'Deleted') : 'Unknown Campaign'
  })));
}
