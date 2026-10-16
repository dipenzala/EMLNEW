import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { parseCsv, mapAndValidate } from '@/lib/csv';
import { log, logError } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';
const MAX_BYTES = 5 * 1024 * 1024;
export async function POST(req: Request) {
  const user = await requireUser();
  if (!rateLimit(`import:${user.id}`, 10, 60_000)) return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  const form = await req.formData().catch(() => null); if (!form) return NextResponse.json({ error: 'missing form' }, { status: 400 });
  const file = form.get('file'); if (!(file instanceof File)) return NextResponse.json({ error: 'missing file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (max 5 MB per request)' }, { status: 413 });
  const text = await file.text(); const { headers, rows, errors } = parseCsv(text);
  if (!headers.length) return NextResponse.json({ error: 'empty csv', details: errors }, { status: 400 });
  const lower = (s: string) => s.toLowerCase();
  const find = (cands: string[]) => headers.find((h) => cands.some((c) => lower(h).includes(c)));
  const mapping = { email: find(['email','e-mail']) ?? headers[0], first_name: find(['first name','firstname','given']) ?? undefined, last_name: find(['last name','lastname','surname','family']) ?? undefined, company_name: find(['company','organization','org']) ?? undefined, tags: find(['tag','segment','label']) ?? undefined };
  const parsed = mapAndValidate(rows, mapping); const valid = parsed.filter((r) => r.errors.length === 0);
  if (!valid.length) return NextResponse.json({ error: 'no valid rows', summary: { total: parsed.length, invalid: parsed.length } }, { status: 400 });
  const admin = createSupabaseAdmin(); let inserted = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500).map((r) => ({ user_id: user.id, email: r.email, first_name: r.first_name, last_name: r.last_name, company_name: r.company_name, tags: r.tags, source: 'csv-import' }));
    const { error, count } = await admin.from('contacts').upsert(chunk, { onConflict: 'user_id,email', ignoreDuplicates: true, count: 'exact' });
    if (error) { logError('contact.import.chunk', error); } else inserted += count ?? 0;
  }
  log('contacts.imported', { userId: user.id, total: parsed.length, valid: valid.length, inserted });
  return NextResponse.json({ ok: true, inserted, skipped: parsed.length - valid.length, summary: { total: parsed.length, invalid: parsed.length - valid.length } });
}
