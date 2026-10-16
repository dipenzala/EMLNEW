import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';
import { rateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/logger';
export async function POST() {
  const user = await requireUser();
  if (!rateLimit(`process-batch:${user.id}`, 6, 60_000)) return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  const sb = createSupabaseServer();
  const { data: profile } = await sb.from('profiles').select('batch_size,global_sending_enabled').eq('id', user.id).maybeSingle();
  if (profile && !profile.global_sending_enabled) return NextResponse.json({ error: 'global sending disabled in profile' }, { status: 400 });
  const limit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), profile?.batch_size ?? 5);
  try { const result = await processBatch(user.id, limit); log('process-batch.done', { userId: user.id, ...result }); return NextResponse.json(result); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }); }
}
