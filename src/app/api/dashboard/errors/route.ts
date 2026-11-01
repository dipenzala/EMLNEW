import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  // Fetch jobs that have an error message or were reset
  const { data: errors } = await admin.from('email_jobs')
    .select('id, to_email, status, last_error, created_at, attempts')
    .not('last_error', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);

  return NextResponse.json(errors || []);
}
