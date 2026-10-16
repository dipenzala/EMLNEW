import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
export async function POST(req: Request) {
  const sb = createSupabaseServer(); await sb.auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
