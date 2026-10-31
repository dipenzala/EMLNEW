import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { emailSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const admin = createSupabaseAdmin();
    
    const body = await req.json().catch(() => ({}));
    const contacts = body.contacts as Array<{ email: string; first_name?: string }>;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });
    }

    // Filter valid emails
    const unique = new Map();
    let invalidCount = 0;
    contacts.forEach(c => {
      const e = String(c.email || '').trim().toLowerCase();
      if (emailSchema.safeParse(e).success) {
        unique.set(e, { email: e, first_name: c.first_name || null });
      } else {
        invalidCount++;
      }
    });

    const valid = Array.from(unique.values());
    if (valid.length === 0) return NextResponse.json({ ok: true, inserted: 0, invalidCount, totalCount: 0, queued: 0 });

    // 1. Insert into Contacts Table
    const { data: insertedCount, error: insertError } = await admin.rpc('bulk_insert_campaign_contacts', {
      p_user_id: user.id,
      p_campaign_id: params.id,
      p_contacts: valid
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // 2. 🔥 AUTO-QUEUE: Instantly move to Email Jobs
    const { data: queuedCount, error: queueError } = await admin.rpc('enqueue_campaign_jobs_bulk', {
      p_campaign_id: params.id, 
      p_user_id: user.id, 
      p_sender_id: null // Auto-pick sender
    });

    if (queueError) console.error("Queue Error:", queueError);

    // 3. Mark campaign as running
    await admin.from('campaigns').update({ status: 'running' }).eq('id', params.id);

    const { count: totalCount } = await admin.from('contacts').select('id', { count: 'exact', head: true }).eq('campaign_id', params.id);

    return NextResponse.json({ 
      ok: true, 
      inserted: insertedCount || 0, 
      invalidCount, 
      totalCount: totalCount || 0,
      queued: queuedCount || 0
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
