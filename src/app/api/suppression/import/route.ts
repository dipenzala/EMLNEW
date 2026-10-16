import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { parseCsv } from '@/lib/csv';
import { emailSchema } from '@/lib/validation';
export async function POST(req: Request) {
  const user = await requireUser(); const form = await req.formData().catch(() => null); const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'missing file' }, { status: 400 });
  const { headers, rows } = parseCsv(await file.text()); const emailCol = headers.find((h) => h.toLowerCase().includes('email')) ?? headers[0];
  if (!emailCol) return NextResponse.json({ error: 'no email column' }, { status: 400 });
  const valid = rows.map((r) => (r[emailCol] ?? '').trim().toLowerCase()).filter((e) => emailSchema.safeParse(e).success);
  const unique = Array.from(new Set(valid)); const admin = createSupabaseAdmin(); let inserted = 0;
  for (let i = 0; i < unique.length; i += 500) {
    const { count } = await admin.from('suppression_list').upsert(unique.slice(i, i + 500).map((email) => ({ user_id: user.id, email, reason: 'imported' })), { onConflict: 'user_id,email', ignoreDuplicates: true, count: 'exact' });
    inserted += count ?? 0;
  }
  return NextResponse.json({ ok: true, inserted });
}
