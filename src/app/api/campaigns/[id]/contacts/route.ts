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

    // Filter valid emails and remove duplicates within the chunk
    const unique = new Map();
    contacts.forEach(c => {
      const e = String(c.email || '').trim().toLowerCase();
      if (e.includes('@')) {
        unique.set(e, { 
          user_id: user.id, 
          campaign_id: params.id, 
          email: e, 
          first_name: c.first_name || null 
        });
      }
    });

    const valid = Array.from(unique.values());
    let inserted = 0;

    // Insert in batches of 500
    for (let i = 0; i < valid.length; i += 500) {
      const chunk = valid.slice(i, i + 500);
      
      // Use upsert with onConflict. If this fails, it means SQL wasn't run.
      const { error, count } = await admin
        .from('contacts')
        .upsert(chunk, { onConflict: 'campaign_id,email', ignoreDuplicates: true, count: 'exact' });
      
      if (error) {
        console.error("DB Insert Error:", error.message);
        // Return exact DB error to frontend
        return NextResponse.json({ error: `Database error: ${error.message}. Please run the SQL fix in Supabase.` }, { status: 500 });
      }
      
      inserted += (count || 0);
    }
    
    return NextResponse.json({ ok: true, inserted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
