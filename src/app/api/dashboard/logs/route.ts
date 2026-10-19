import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();

  // Get recent global sent jobs
  const { data: jobs } = await admin
    .from('email_jobs')
    .select('id, to_email, status, created_at, sender_account_id')
    .in('status', ['accepted', 'failed', 'uncertain'])
    .not('to_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!jobs) return NextResponse.json([]);

  const senderIds = [...new Set(jobs.map(j => j.sender_account_id).filter(Boolean))];
  const { data: senders } = await admin.from('sender_accounts').select('id, google_email').in('id', senderIds);
  
  const senderMap = new Map();
  senders?.forEach(s => senderMap.set(s.id, s.google_email));

  return NextResponse.json(jobs.map(j => ({
    id: j.id, to_email: j.to_email, status: j.status, created_at: j.created_at,
    sender_email: j.sender_account_id ? (senderMap.get(j.sender_account_id) || 'Deleted Sender') : 'Auto-Robin'
  })));
}
