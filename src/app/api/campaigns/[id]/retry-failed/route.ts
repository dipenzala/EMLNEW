import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  // Update all failed jobs back to queued
  const { error, count } = await admin
    .from('email_jobs')
    .update({ status: 'queued', next_attempt_at: new Date().toISOString(), last_error: null })
    .eq('campaign_id', params.id)
    .eq('user_id', user.id)
    .eq('status', 'failed');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, retried: count || 0 });
}
