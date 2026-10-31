import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Vercel Hobby plan limit

export async function POST() {
  const user = await requireUser();
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return NextResponse.json({ error: 'Global sending disabled.' }, { status: 400 });

  try { 
    // 🔥 Process only 10 emails per request to prevent timeout
    const result = await processBatch(user.id, 10); 
    
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
