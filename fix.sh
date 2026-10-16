#!/usr/bin/env bash
# CertWinX: shared sender pool + mobile layout fix
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. SQL migration for shared senders
# =============================================================

write "supabase/migrations/0003_shared_senders.sql" <<'SQL'
-- CertWinX 0003: shared sender pool
-- Every signed-in user (including guests) can see and use every sender.

drop policy if exists own_rows on public.sender_accounts;
drop policy if exists shared_senders_read on public.sender_accounts;
drop policy if exists shared_senders_insert on public.sender_accounts;
drop policy if exists shared_senders_update on public.sender_accounts;
drop policy if exists shared_senders_delete on public.sender_accounts;

create policy shared_senders_read on public.sender_accounts
  for select using (auth.uid() is not null);

create policy shared_senders_insert on public.sender_accounts
  for insert with check (auth.uid() is not null);

create policy shared_senders_update on public.sender_accounts
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy shared_senders_delete on public.sender_accounts
  for delete using (auth.uid() is not null);
SQL

# =============================================================
# 2. /api/senders — no user filter
# =============================================================

backup "src/app/api/senders/route.ts"
write "src/app/api/senders/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
export async function GET() {
  await requireUser();
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('sender_accounts')
    .select('id,provider,google_email,display_name,status,paused,daily_cap,last_error,last_used_at,created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
EOF

# =============================================================
# 3. /api/senders/[id] — any user can pause/disconnect
# =============================================================

backup "src/app/api/senders/[id]/route.ts"
write "src/app/api/senders/[id]/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { log } from '@/lib/logger';

const patchSchema = z.object({
  paused: z.boolean().optional(),
  daily_cap: z.number().int().min(1).max(350).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { error } = await admin.from('sender_accounts').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  log('sender.patch.shared', { userId: user.id, senderId: params.id, patch: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  await admin.from('sender_accounts').update({
    status: 'revoked',
    access_token_enc: null,
    refresh_token_enc: null,
    token_expiry: null,
    smtp_password_enc: null,
    updated_at: new Date().toISOString(),
  }).eq('id', params.id);
  log('sender.revoke.shared', { userId: user.id, senderId: params.id });
  return NextResponse.json({ ok: true });
}
EOF

# =============================================================
# 4. queue.ts — pick from shared pool
# =============================================================

backup "src/lib/queue.ts"
node - <<'NODE'
const fs = require('fs');
const file = 'src/lib/queue.ts';
let src = fs.readFileSync(file, 'utf8');
const fnStart = src.indexOf('async function pickAndReserveSender');
if (fnStart === -1) { console.log('[warn] pickAndReserveSender not found'); process.exit(0); }
const fnEnd = src.indexOf('\n}\n', fnStart) + 3;
const newFn = `async function pickAndReserveSender(admin: any, _userId: string, preferred: string | null, cap: number): Promise<string | null> {
  // Shared pool: no user filter.
  if (preferred) {
    const { data: pref } = await admin.from('sender_accounts')
      .select('id,status,paused').eq('id', preferred).maybeSingle();
    if (pref && pref.status === 'connected' && !pref.paused) {
      const { data: ok } = await admin.rpc('reserve_sender_capacity', { p_sender: pref.id, p_cap: cap });
      if (ok) return pref.id;
    }
  }
  const { data: senders } = await admin.from('sender_accounts')
    .select('id').eq('status', 'connected').eq('paused', false);
  if (!senders || senders.length === 0) return null;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const usage = await Promise.all(senders.map(async (s: { id: string }) => {
    const { count } = await admin.from('send_events')
      .select('id', { count: 'exact', head: true })
      .eq('sender_account_id', s.id)
      .in('kind', ['reserved', 'accepted'])
      .gte('created_at', since);
    return { id: s.id, used: count ?? 0 };
  }));
  usage.sort((a: any, b: any) => a.used - b.used);
  for (const s of usage) {
    if (s.used >= cap) continue;
    const { data: ok } = await admin.rpc('reserve_sender_capacity', { p_sender: s.id, p_cap: cap });
    if (ok) return s.id;
  }
  return null;
}
`;
src = src.slice(0, fnStart) + newFn + src.slice(fnEnd);
fs.writeFileSync(file, src);
console.log('[patched] queue.ts pickAndReserveSender → shared pool');
NODE

# =============================================================
# 5. quick-send — pick any connected sender
# =============================================================

backup "src/app/api/quick-send/route.ts"
node - <<'NODE'
const fs = require('fs');
const file = 'src/app/api/quick-send/route.ts';
let src = fs.readFileSync(file, 'utf8');
const oldFn = `async function pickSender(admin: any, userId: string, preferred: string | null) {
  if (preferred) {
    const { data } = await admin.from('sender_accounts').select('id,google_email,display_name,status,paused').eq('id', preferred).eq('user_id', userId).maybeSingle();
    if (data && data.status === 'connected' && !data.paused) return data;
  }
  const { data: list } = await admin.from('sender_accounts')
    .select('id,google_email,display_name,status,paused,last_used_at')
    .eq('user_id', userId).eq('status', 'connected').eq('paused', false)
    .order('last_used_at', { ascending: true, nullsFirst: true }).limit(1);
  return list?.[0] ?? null;
}`;
const newFn = `async function pickSender(admin: any, _userId: string, preferred: string | null) {
  // Shared pool: no user filter.
  if (preferred) {
    const { data } = await admin.from('sender_accounts').select('id,google_email,display_name,status,paused').eq('id', preferred).maybeSingle();
    if (data && data.status === 'connected' && !data.paused) return data;
  }
  const { data: list } = await admin.from('sender_accounts')
    .select('id,google_email,display_name,status,paused,last_used_at')
    .eq('status', 'connected').eq('paused', false)
    .order('last_used_at', { ascending: true, nullsFirst: true }).limit(1);
  return list?.[0] ?? null;
}`;
if (src.includes(oldFn)) {
  src = src.replace(oldFn, newFn);
  fs.writeFileSync(file, src);
  console.log('[patched] quick-send pickSender → shared pool');
} else {
  console.log('[warn] quick-send pattern not found');
}
NODE

# =============================================================
# 6. campaign action route — shared pool for test_send / send_now
# =============================================================

backup "src/app/api/campaigns/[id]/action/route.ts"
node - <<'NODE'
const fs = require('fs');
const file = 'src/app/api/campaigns/[id]/action/route.ts';
let src = fs.readFileSync(file, 'utf8');
let count = 0;
const a = `.from('sender_accounts').select('id').eq('user_id', user.id).eq('status', 'connected').eq('paused', false).limit(1).maybeSingle();`;
const b = `.from('sender_accounts').select('id').eq('status', 'connected').eq('paused', false).limit(1).maybeSingle();`;
const c = `.from('sender_accounts').select('id').eq('user_id', user.id).eq('status', 'connected').eq('paused', false);`;
const d = `.from('sender_accounts').select('id').eq('status', 'connected').eq('paused', false);`;
if (src.includes(a)) { src = src.replace(a, b); count++; }
if (src.includes(c)) { src = src.replace(c, d); count++; }
if (count > 0) { fs.writeFileSync(file, src); console.log(`[patched] campaign action → shared (${count})`); }
else console.log('[warn] campaign action patterns not found');
NODE

# =============================================================
# 7. Mobile CSS — force override (idempotent)
# =============================================================

MARK="/* CertWinX mobile-fix v2 */"
if ! grep -qF "$MARK" "src/app/globals.css" 2>/dev/null; then
  cat >> "src/app/globals.css" <<'CSS'

/* CertWinX mobile-fix v2 */
@media (max-width: 900px) {
  html, body { overflow-x: hidden; }
  .app-shell { grid-template-columns: 1fr !important; grid-template-rows: auto 1fr !important; }
  .sidebar {
    position: sticky !important; top: 0; z-index: 40;
    height: auto !important; max-height: none !important;
    width: 100% !important;
    padding: 10px 14px !important;
    border-right: none !important;
    border-bottom: 1px solid var(--line);
    background: rgba(255,255,255,0.95);
    backdrop-filter: saturate(180%) blur(12px);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    display: flex !important; flex-direction: row !important;
    align-items: center !important; gap: 14px !important;
    overflow-x: auto !important; overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
    white-space: nowrap;
  }
  .sidebar .brand { padding: 0 !important; margin: 0 !important; font-size: 16px; flex-shrink: 0; }
  .sidebar .brand::before { width: 26px; height: 26px; font-size: 13px; }
  .nav { display: flex !important; flex-direction: row !important; gap: 4px !important; flex-shrink: 0; padding: 0 !important; margin: 0 !important; }
  .nav a { white-space: nowrap; padding: 6px 11px !important; margin: 0 !important; font-size: 13px; border-radius: 999px; }
  .nav a.active { background: var(--blue); color: #fff; }
  .main { padding: 14px 14px 40px !important; }
  .topbar { margin-bottom: 16px; gap: 8px; }
  .topbar h1 { font-size: 19px; }
  .grid-2, .grid-3 { grid-template-columns: 1fr !important; gap: 14px; }
  .grid-4 { grid-template-columns: repeat(2, 1fr) !important; gap: 12px; }
  .card { padding: 16px; border-radius: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .metric { font-size: 22px; }
  .table { min-width: 640px; font-size: 13px; }
  .table th, .table td { padding: 9px 10px; }
  .btn { padding: 9px 14px; font-size: 13.5px; }
  .btn-sm { padding: 7px 10px; font-size: 12.5px; }
  .input, .select, .textarea { font-size: 16px; }
}
@media (max-width: 480px) {
  .grid-4 { grid-template-columns: 1fr !important; }
}
CSS
  say "appended mobile-fix v2 CSS"
else
  say "mobile-fix v2 already applied"
fi

say ""
say "✅ Fix applied."
say ""
say "⚠️ MANUAL STEP (required):"
say "  Open Supabase → SQL Editor → paste and run:"
say "    supabase/migrations/0003_shared_senders.sql"
say ""
say "Then:"
say "  git add . && git commit -m 'Shared sender pool + mobile fix v2' && git push"