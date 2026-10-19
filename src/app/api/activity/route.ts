import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();

  // 1. Fetch recent jobs (Ensure we only get ones with valid data)
  const { data: jobs, error } = await admin
    .from('email_jobs')
    .select('id, to_email, status, created_at, sender_account_id')
    .in('status', ['accepted', 'failed', 'uncertain'])
    .not('to_email', 'is', null) // Skip completely broken rows
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs || jobs.length === 0) return NextResponse.json([]);

  // 2. Fetch sender emails manually (to avoid Supabase join bugs)
  const senderIds = [...new Set(jobs.map(j => j.sender_account_id).filter(Boolean))];
  const { data: senders } = await admin.from('sender_accounts').select('id, google_email').in('id', senderIds);
  
  const senderMap = new Map();
  senders?.forEach(s => senderMap.set(s.id, s.google_email));

  // 3. Combine data
  const enrichedJobs = jobs.map(j => ({
    id: j.id,
    to_email: j.to_email,
    status: j.status,
    created_at: j.created_at,
    sender_email: j.sender_account_id ? (senderMap.get(j.sender_account_id) || 'Deleted Sender') : 'Auto-Round Robin'
  }));

  return NextResponse.json(enrichedJobs);
}
