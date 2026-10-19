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

    // Filter and deduplicate
    const unique = new Map();
    contacts.forEach(c => {
      const e = String(c.email || '').trim().toLowerCase();
      if (e.includes('@')) unique.set(e, { email: e, first_name: c.first_name || null });
    });

    const valid = Array.from(unique.values());
    let inserted = 0;

    for (let i = 0; i < valid.length; i += 500) {
      const chunk = valid.slice(i, i + 500);
      
      // Attempt 1: Use RPC (if user ran the SQL function)
      const { data: rpcCount, error: rpcError } = await admin.rpc('bulk_upsert_campaign_contacts', {
        p_user_id: user.id,
        p_campaign_id: params.id,
        p_contacts: chunk
      });
      
      if (!rpcError) {
        inserted += (rpcCount || 0);
        continue;
      }
      
      // Attempt 2: Standard upsert (if RPC doesn't exist but index does)
      const { error: upsertError, count } = await admin
        .from('contacts')
        .upsert(
          chunk.map(c => ({ ...c, user_id: user.id, campaign_id: params.id })), 
          { onConflict: 'campaign_id,email', ignoreDuplicates: true, count: 'exact' }
        );
        
      if (upsertError) {
        console.error("DB Error:", upsertError.message);
        return NextResponse.json({ 
          error: `Database error: ${upsertError.message}. Please run the SQL fix in Supabase (create unique index).` 
        }, { status: 500 });
      }
      inserted += (count || 0);
    }
    
    return NextResponse.json({ ok: true, inserted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
