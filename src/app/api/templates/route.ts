import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { sanitizeUserHtml } from '@/lib/template';

const schema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().max(300).default(''),
  html: z.string().max(200_000).default(''),
  text_body: z.string().max(200_000).default(''),
});

export async function GET() {
  const user = await requireUser();
  const sb = createSupabaseServer();
  const { data } = await sb.from('email_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('email_templates').insert({
    user_id: user.id,
    name: parsed.data.name,
    subject: parsed.data.subject,
    html: sanitizeUserHtml(parsed.data.html),
    text_body: parsed.data.text_body,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
