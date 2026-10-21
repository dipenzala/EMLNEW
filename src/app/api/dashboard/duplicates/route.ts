import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireUser();
  const admin = createSupabaseAdmin();
  
  // Fetch all accepted jobs to find duplicates
  const { data: jobs } = await admin.from('email_jobs').select('to_email, status').eq('status', 'accepted');
  
  if (!jobs) return NextResponse.json([]);

  const counts: Record<string, number> = {};
  jobs.forEach(j => { counts[j.to_email] = (counts[j.to_email] || 0) + 1; });

  const duplicates = Object.entries(counts)
    .filter(([_, count]) => count > 1)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 duplicates

  return NextResponse.json(duplicates);
}
