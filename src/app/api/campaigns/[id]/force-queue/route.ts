import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const admin = createSupabaseAdmin();
    
    // 1. Get all contacts for this campaign
    const { data: contacts } = await admin
      .from('contacts')
      .select('id, email')
      .eq('campaign_id', params.id)
      .eq('unsubscribed', false);

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found' }, { status: 400 });
    }

    // 2. Prepare rows for email_jobs
    const rows = contacts.map(c => ({
      campaign_id: params.id,
      user_id: user.id,
      contact_id: c.id,
      to_email: c.email,
      status: 'queued'
    }));

    // 3. Insert in chunks of 2000
    let totalEnqueued = 0;
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = rows.slice(i, i + 2000);
      const { error, count } = await admin.from('email_jobs').upsert(chunk, { 
        onConflict: 'campaign_id,contact_id', 
        ignoreDuplicates: true, 
        count: 'exact' 
      });
      if (!error) totalEnqueued += (count || 0);
    }

    // 4. Update campaign status to running
    await admin.from('campaigns').update({ status: 'running' }).eq('id', params.id);

    return NextResponse.json({ ok: true, totalEnqueued });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
