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

    const unique = new Map();
    let invalidCount = 0;

    contacts.forEach(c => {
      const e = String(c.email || '').trim().toLowerCase();
      if (emailSchema.safeParse(e).success) {
        unique.set(e, { 
          user_id: user.id, 
          campaign_id: params.id, 
          email: e, 
          first_name: c.first_name || null 
        });
      } else {
        invalidCount++;
      }
    });

    const valid = Array.from(unique.values());
    let inserted = 0;

    if (valid.length > 0) {
      for (let i = 0; i < valid.length; i += 500) {
        const chunk = valid.slice(i, i + 500);
        // ON CONFLICT ensures duplicates aren't added
        const { error, count } = await admin.from('contacts').upsert(chunk, { 
          onConflict: 'campaign_id,email', 
          ignoreDuplicates: true, 
          count: 'exact' 
        });
        if (!error) inserted += count ?? 0;
      }
    }

    const { count: totalCount } = await admin.from('contacts').select('id', { count: 'exact', head: true }).eq('campaign_id', params.id);

    return NextResponse.json({ ok: true, inserted, invalidCount, totalCount: totalCount || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}