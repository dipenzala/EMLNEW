import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { settingsInput } from '@/lib/validation';
export async function GET() {
  const user = await requireUser(); const sb = createSupabaseServer();
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    const insert = { id: user.id, email: user.email!, timezone: process.env.DEFAULT_TIMEZONE ?? 'Asia/Kolkata', batch_size: Number(process.env.MAX_BATCH_SIZE ?? 5), sender_daily_cap: Number(process.env.MAX_EMAILS_PER_SENDER_24H ?? 350), global_sending_enabled: false };
    await sb.from('profiles').insert(insert); return NextResponse.json(insert);
  }
  return NextResponse.json(data);
}
export async function PATCH(req: Request) {
  const user = await requireUser(); const parsed = settingsInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 });
  const sb = createSupabaseServer();
  const { error } = await sb.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
