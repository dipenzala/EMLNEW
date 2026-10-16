import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ ok: true, t: new Date().toISOString(), node: process.version, env: { supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL, google: !!process.env.GOOGLE_CLIENT_ID, hostinger: true, cron: !!process.env.CRON_SECRET, encryption: !!process.env.TOKEN_ENCRYPTION_KEY, sending_enabled: (process.env.GLOBAL_SENDING_ENABLED ?? 'false') === 'true' } });
}
