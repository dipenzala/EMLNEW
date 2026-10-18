import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = createSupabaseAdmin();
  // Fire and forget log
  admin.from('email_events').insert({ job_id: params.id, event_type: 'open' }).then();
  
  // Return 1x1 transparent gif
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return new NextResponse(gif, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  });
}
