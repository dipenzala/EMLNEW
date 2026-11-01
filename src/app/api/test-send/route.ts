import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { sendViaSender } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  // Get 1 queued job
  const { data: job } = await admin.from('email_jobs').select('*, campaigns(*), sender_accounts(*)').eq('user_id', user.id).eq('status', 'queued').limit(1).maybeSingle();
  if (!job) return NextResponse.json({ error: 'No queued emails found.' });

  // Mark as processing
  await admin.from('email_jobs').update({ status: 'processing' }).eq('id', job.id);

  try {
    const messageId = await sendViaSender(job.sender_account_id, {
      to: job.to_email,
      subject: job.campaigns.subject,
      html: job.campaigns.html,
      text: 'Test text'
    });
    
    await admin.from('email_jobs').update({ status: 'accepted', message_id: messageId }).eq('id', job.id);
    return NextResponse.json({ ok: true, message: `Successfully sent to ${job.to_email}` });
  } catch (err: any) {
    // 🔥 SAVE EXACT ERROR
    const errorMsg = err.message || String(err);
    await admin.from('email_jobs').update({ status: 'failed', last_error: errorMsg }).eq('id', job.id);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
