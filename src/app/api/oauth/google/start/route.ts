import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { buildAuthUrl } from '@/lib/gmail';
import { randomToken } from '@/lib/crypto';
export async function GET(req: Request) {
  try {
    const user = await requireUser(); const state = randomToken(24); const admin = createSupabaseAdmin();
    await admin.from('oauth_states').insert({ state, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    return NextResponse.redirect(buildAuthUrl(state));
  } catch (e) {
    const url = new URL('/help', req.url); url.searchParams.set('error', e instanceof Error ? e.message : 'oauth_start_failed'); return NextResponse.redirect(url);
  }
}
