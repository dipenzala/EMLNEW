import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireUser();
    const admin = createSupabaseAdmin();
    
    // Aaj ki shuruat ka time nikalo
    const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();
    
    // Aaj ke saare send events delete kardo taaki limit reset ho jaye
    const { error } = await admin.from('send_events')
      .delete()
      .gte('created_at', todayStart);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}