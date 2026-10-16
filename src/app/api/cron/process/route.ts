import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';
import { log } from '@/lib/logger';
import { timingSafeEq } from '@/lib/crypto';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET; if (!secret) return false;
  const hdr = req.headers.get('authorization') ?? ''; const provided = hdr.replace(/^Bearer\s+/i, '').trim();
  return provided.length > 0 && timingSafeEq(provided, secret);
}
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return NextResponse.json({ ok: true, skipped: 'killswitch' });
  const admin = createSupabaseAdmin();
  const { data: profiles } = await admin.from('profiles').select('id,batch_size,global_sending_enabled').eq('global_sending_enabled', true).limit(25);
  let claimed = 0, sent = 0, failed = 0;
  for (const p of profiles ?? []) {
    const limit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), p.batch_size ?? 5);
    try { const r = await processBatch(p.id, limit); claimed += r.claimed; sent += r.sent; failed += r.failed; }
    catch (e) { log('cron.process.profile_failed', { profile: p.id, error: e instanceof Error ? e.message : String(e) }); }
  }
  log('cron.process.done', { claimed, sent, failed });
  return NextResponse.json({ ok: true, claimed, sent, failed });
}
