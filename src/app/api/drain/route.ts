import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';
import { log, logError } from '@/lib/logger';
import { timingSafeEq } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return provided.length > 0 && timingSafeEq(provided, secret);
}

async function countRemaining(userId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const { count } = await admin
    .from('email_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'queued');
  return count ?? 0;
}

async function chainSelf(userId: string, depth: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) return;
  if (depth > 2000) {
    logError('drain.chain_depth_exceeded', new Error('too deep'), { userId, depth });
    return;
  }
  await new Promise((r) => setTimeout(r, 1200));
  try {
    await fetch(`${appUrl}/api/drain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ userId, depth }),
    });
  } catch (e) {
    logError('drain.chain_failed', e, { userId, depth });
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'killswitch' });
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const depth = (body.depth as number) ?? 0;
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('batch_size,global_sending_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (profile && !profile.global_sending_enabled) {
    return NextResponse.json({ error: 'profile killswitch off' }, { status: 400 });
  }

  const limit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), profile?.batch_size ?? 5);
  const result = await processBatch(userId, limit);
  const remaining = await countRemaining(userId);

  log('drain.tick', { userId, depth, ...result, remaining });

  if (remaining > 0 && result.claimed > 0) {
    waitUntil(chainSelf(userId, depth + 1));
  }

  return NextResponse.json({ ok: true, depth, ...result, remaining });
}
