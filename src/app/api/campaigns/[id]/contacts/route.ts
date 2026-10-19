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
          email: e, 
          first_name: c.first_name ? String(c.first_name).trim() : null 
        });
      }
    });

    const valid = Array.from(unique.values());
    let inserted = 0;

    // Insert in batches of 500 using RPC
    for (let i = 0; i < valid.length; i += 500) {
      const chunk = valid.slice(i, i + 500);
      
      // Call the database function we created in SQL
      const { data: count, error } = await admin.rpc('bulk_upsert_campaign_contacts', {
        p_user_id: user.id,
        p_campaign_id: params.id,
        p_contacts: chunk
      });
      
      if (error) {
        console.error("DB Insert Error:", error.message);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }
      
      inserted += (count || 0);
    }
    
    return NextResponse.json({ ok: true, inserted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
