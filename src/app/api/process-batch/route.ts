import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { processBatch } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await requireUser();
  
  // Only rely on the ENV variable for global killswitch
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
    return NextResponse.json({ error: 'Global sending is disabled in environment variables.' }, { status: 400 });
  }

  try { 
    // Process a batch of 50 emails manually
    const result = await processBatch(user.id, 50); 
    return NextResponse.json(result); 
  }
  catch (e) { 
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }); 
  }
}
