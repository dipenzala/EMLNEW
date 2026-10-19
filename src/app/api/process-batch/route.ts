import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await requireUser();
  
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
    return NextResponse.json({ error: 'Global sending is disabled.' }, { status: 400 });
  }

  try { 
    // Process first batch of 50
    const result = await processBatch(user.id, 50); 
    
    // 🔥 TRIGGER THE BACKGROUND LOOP (Chain)
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
  catch (e) { 
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }); 
  }
}
