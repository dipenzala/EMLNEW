import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  // Find jobs that have a recorded error, regardless of current status
  const { data } = await admin.from('email_jobs')
    .select('to_email, status, last_error, attempts, created_at')
    .not('last_error', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  return NextResponse.json(data || []);
}
