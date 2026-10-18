import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return NextResponse.redirect(new URL('/', req.url));

  const admin = createSupabaseAdmin();
  admin.from('email_events').insert({ job_id: params.id, event_type: 'click', url }).then();

  return NextResponse.redirect(url);
}
