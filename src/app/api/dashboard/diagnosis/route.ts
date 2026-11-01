import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  // Get the latest 5 errors
  const { data } = await admin.from('email_jobs')
    .select('to_email, status, last_error, attempts, created_at')
    .in('status', ['failed', 'uncertain'])
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json(data || []);
}
