import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { emailSchema } from '@/lib/validation';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  
  const { data: campaign } = await admin.from('campaigns').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const contacts = body.contacts as Array<{ email: string; first_name?: string; company_name?: string }>;
  if (!Array.isArray(contacts) || contacts.length === 0) return NextResponse.json({ error: 'no contacts' }, { status: 400 });

  // Deduplicate within the chunk itself to prevent ON CONFLICT errors
  const uniqueContacts = new Map();
  contacts.forEach(c => {
    const e = String(c.email || '').trim().toLowerCase();
    if (emailSchema.safeParse(e).success) {
      uniqueContacts.set(e, { 
        user_id: user.id, campaign_id: params.id, email: e, 
        first_name: c.first_name ? String(c.first_name).trim() : null, 
        source: 'campaign-import'
      });
    }
  });

  const valid = Array.from(uniqueContacts.values());
  let inserted = 0;

  // Insert in chunks of 500 to prevent DB timeouts
  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500);
    const { error, count } = await admin
      .from('contacts')
      .upsert(chunk, { onConflict: 'campaign_id,email', ignoreDuplicates: true, count: 'exact' });
    
    if (!error) inserted += count ?? 0;
    else console.error("Chunk insert error:", error);
  }
  
  return NextResponse.json({ ok: true, inserted });
}
