import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

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

    // 1. Filter and deduplicate within this chunk
    const unique = new Map();
    contacts.forEach(c => {
      const e = String(c.email || '').trim().toLowerCase();
      if (e.includes('@')) {
        unique.set(e, { 
          user_id: user.id, 
          campaign_id: params.id, 
          email: e, 
          first_name: c.first_name ? String(c.first_name).trim() : null 
        });
      }
    });

    const valid = Array.from(unique.values());
    let inserted = 0;

    // 2. Insert in batches of 500
    for (let i = 0; i < valid.length; i += 500) {
      const chunk = valid.slice(i, i + 500);
      
      // Use standard upsert, but if it fails (due to missing SQL index), catch the error
      const { error, count } = await admin
        .from('contacts')
        .upsert(chunk, { onConflict: 'campaign_id,email', ignoreDuplicates: true, count: 'exact' });
      
      if (error) {
        console.error("DB Insert Error:", error.message);
        return NextResponse.json({ error: `Database error: ${error.message}. Please run the SQL fix in Supabase.` }, { status: 500 });
      }
      inserted += (count || 0);
    }
    
    // 3. Get the TRUE total count for this campaign
    const { count: totalCount } = await admin
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', params.id);

    return NextResponse.json({ ok: true, inserted, totalCount: totalCount || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
