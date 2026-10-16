#!/usr/bin/env bash
# CertWinX: hard-force "Startup India Certificate" everywhere
set -euo pipefail
[ -f "package.json" ] || { echo "Run from project root."; exit 1; }

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. mailer.ts — hard override (rewrite whole file)
# =============================================================

backup "src/lib/mailer.ts"
cat > "src/lib/mailer.ts" <<'EOF'
import nodemailer from 'nodemailer';
import { createSupabaseAdmin } from './supabase/server';
import { getAccessTokenForSender, sendRawMessage, buildRawMessage } from './gmail';
import { decrypt } from './crypto';

/** The one and only from-name for every outgoing email. */
const FORCED_FROM_NAME = 'Startup India Certificate';

export type ProviderMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
  listUnsubscribeMailto?: string;
};

export async function sendViaSender(senderId: string, msg: ProviderMessage): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data: sender, error } = await admin
    .from('sender_accounts')
    .select('*')
    .eq('id', senderId)
    .single();
  if (error || !sender) throw new Error('Sender not found');
  if (sender.status !== 'connected') throw new Error('Sender not connected');
  if (sender.paused) throw new Error('Sender paused');

  // Extract real sender email from "Name <email@x.com>" or bare email
  const emailMatch = (msg.from || '').match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1] : (sender.smtp_user || sender.google_email);

  // HARD OVERRIDE — from name is always "Startup India Certificate"
  const forcedFrom = `${FORCED_FROM_NAME} <${senderEmail}>`;
  const forcedMsg: ProviderMessage = { ...msg, from: forcedFrom };

  if (sender.provider === 'hostinger') return sendViaHostinger(sender, forcedMsg);
  return sendViaGmail(senderId, forcedMsg);
}

async function sendViaGmail(senderId: string, msg: ProviderMessage): Promise<string> {
  const access = await getAccessTokenForSender(senderId);
  const raw = buildRawMessage(msg);
  return sendRawMessage(access, raw);
}

async function sendViaHostinger(sender: any, msg: ProviderMessage): Promise<string> {
  if (!sender.smtp_password_enc) throw new Error('Hostinger sender missing SMTP password');
  const pass = decrypt(sender.smtp_password_enc);
  const transport = nodemailer.createTransport({
    host: sender.smtp_host || 'smtp.hostinger.com',
    port: sender.smtp_port ?? 465,
    secure: sender.smtp_secure !== false,
    auth: { user: sender.smtp_user || sender.google_email, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });

  const headers: Record<string, string> = {};
  if (msg.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${msg.unsubscribeUrl}>${msg.listUnsubscribeMailto ? `, <mailto:${msg.listUnsubscribeMailto}>` : ''}`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  try {
    const info = await transport.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      headers,
    });
    return info.messageId || '';
  } finally {
    transport.close();
  }
}

export async function verifyHostingerSmtp(opts: {
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
}): Promise<void> {
  const transport = nodemailer.createTransport({
    host: opts.host || 'smtp.hostinger.com',
    port: opts.port ?? 465,
    secure: opts.secure !== false,
    auth: { user: opts.user, pass: opts.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}
EOF

say "rewrote src/lib/mailer.ts"

# =============================================================
# 2. SQL — force every existing + new sender's display_name
# =============================================================

mkdir -p supabase/migrations
cat > "supabase/migrations/0005_force_name.sql" <<'SQL'
-- Force every sender's display name to "Startup India Certificate"
update public.sender_accounts
  set display_name = 'Startup India Certificate';

create or replace function public.force_sender_display_name()
returns trigger language plpgsql as $$
begin
  new.display_name := 'Startup India Certificate';
  return new;
end $$;

drop trigger if exists trg_force_sender_display_name on public.sender_accounts;
create trigger trg_force_sender_display_name
  before insert or update on public.sender_accounts
  for each row execute function public.force_sender_display_name();
SQL

say "wrote supabase/migrations/0005_force_name.sql"

# =============================================================
# 3. Sanity check — grep for other places that build 'from'
# =============================================================

say ""
say "🔍 Sanity check: any other place that builds 'from' header?"
grep -rn "from.*<.*@" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "FORCED_FROM_NAME" | grep -v "\.bak\." || say "   (none found — good)"

say ""
say "✅ Done. Force name applied everywhere."
say ""
say "⚠️ MANUAL STEP — run this SQL in Supabase:"
say "   supabase/migrations/0005_force_name.sql"
say ""
say "Then:"
say "   npm run build && git add . && git commit -m 'force sender name = Startup India Certificate' && git push"