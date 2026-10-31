import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const user = await requireUser();
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return NextResponse.json({ error: 'Global sending disabled.' }, { status: 400 });

  try { 
    // 🔥 Reduce batch size to 25 to avoid 60s timeout
    const result = await processBatch(user.id, 25); 
    
    // Auto-trigger next batch in background (chain)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      fetch(`${appUrl}/api/drain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ userId: user.id, depth: 0 }),
      }).catch(() => {});
    }
    return NextResponse.json(result); 
  }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }); }
}
