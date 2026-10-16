#!/usr/bin/env bash
# CertWinX: add permanent Delete button to campaigns list
set -euo pipefail
[ -f "package.json" ] || { echo "Run from project root."; exit 1; }

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. API: add DELETE handler to /api/campaigns/[id]
# =============================================================

backup "src/app/api/campaigns/[id]/route.ts"

node - <<'NODE'
const fs = require('fs');
const file = 'src/app/api/campaigns/[id]/route.ts';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('export async function DELETE')) {
  console.log('[skip] DELETE already exists');
  process.exit(0);
}

// Add DELETE handler at end of file
src += `

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  // Confirm ownership
  const { data: owned } = await admin
    .from('campaigns')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Cascade will remove email_jobs (FK on delete cascade)
  const { error } = await admin.from('campaigns').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
`;

// Ensure createSupabaseAdmin is imported
if (!src.includes('createSupabaseAdmin')) {
  src = src.replace(
    /import\s+\{\s*createSupabaseServer\s*\}\s+from\s+'@\/lib\/supabase\/server';/,
    "import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';"
  );
}

fs.writeFileSync(file, src);
console.log('[patched] campaign [id] route — DELETE added');
NODE

say "patched src/app/api/campaigns/[id]/route.ts"

# =============================================================
# 2. UI: add Delete button to campaigns list page
# =============================================================

backup "src/app/(app)/campaigns/page.tsx"

node - <<'NODE'
const fs = require('fs');
const file = 'src/app/(app)/campaigns/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// 1. Add delete helper after archive()
if (!src.includes('async function del(')) {
  const anchor = `  async function archive(id: string) {
    const r = await fetch(\`/api/campaigns/\${id}/action\`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) });
    if (r.ok) { push('Archived'); load(); } else push('Failed');
  }`;

  const replacement = anchor + `

  async function del(id: string, name: string) {
    if (!confirm(\`Permanently delete "\${name}"?\\n\\nThis removes the campaign AND all its queued/sent jobs. Cannot be undone.\`)) return;
    const r = await fetch(\`/api/campaigns/\${id}\`, { method: 'DELETE' });
    if (r.ok) { push('Deleted'); load(); }
    else { const j = await r.json().catch(() => ({})); push(j.error || 'Delete failed'); }
  }`;

  if (src.includes(anchor)) {
    src = src.replace(anchor, replacement);
    console.log('[patched] del() helper added');
  } else {
    console.log('[warn] archive() anchor not found');
  }
}

// 2. Add Delete button in table cell
const oldBtns = `                    <button className="btn btn-sm" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button className="btn btn-sm btn-danger" onClick={() => archive(c.id)}>Archive</button>`;

const newBtns = `                    <button className="btn btn-sm" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button className="btn btn-sm" onClick={() => archive(c.id)}>Archive</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(c.id, c.name)}>Delete</button>`;

if (src.includes(oldBtns)) {
  src = src.replace(oldBtns, newBtns);
  console.log('[patched] Delete button added to row');
} else {
  console.log('[warn] row buttons pattern not found');
}

fs.writeFileSync(file, src);
NODE

say "patched src/app/(app)/campaigns/page.tsx"

say ""
say "✅ Done."
say ""
say "Test locally:"
say "   npm run dev"
say "   → /campaigns → 'Delete' button dikhega"
say ""
say "Then push:"
say "   git add . && git commit -m 'add delete button to campaigns' && git push"#!/usr/bin/env bash
# CertWinX: force "Startup India Certificate" from-name + spam quality checker
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."
[ -d "src/app" ] || die "src/app not found."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. SQL migration — default display_name
# =============================================================

write "supabase/migrations/0004_default_display_name.sql" <<'SQL'
-- CertWinX 0004: force default sender display name
-- Updates existing senders + triggers new inserts to use "Startup India Certificate".

update public.sender_accounts
  set display_name = 'Startup India Certificate'
  where display_name is null
     or display_name = ''
     or display_name = google_email::text;

create or replace function public.default_sender_display_name()
returns trigger language plpgsql as $$
begin
  if new.display_name is null or new.display_name = '' or new.display_name = new.google_email::text then
    new.display_name := 'Startup India Certificate';
  end if;
  return new;
end $$;

drop trigger if exists trg_default_sender_display_name on public.sender_accounts;
create trigger trg_default_sender_display_name
  before insert on public.sender_accounts
  for each row execute function public.default_sender_display_name();
SQL

# =============================================================
# 2. LIB: spam quality checker
# =============================================================

write "src/lib/spam.ts" <<'EOF'
export type SpamIssue = { severity: 'warn' | 'error'; text: string };

export type SpamReport = {
  score: number;                 // 0 (clean) .. 10 (very spammy)
  level: 'good' | 'warn' | 'bad'; // good <3, warn <6, bad >=6
  issues: SpamIssue[];
  stats: {
    subjectLength: number;
    bodyLength: number;
    linkCount: number;
    imageCount: number;
    triggers: string[];
  };
};

const TRIGGER_WORDS = [
  'free', 'guaranteed', 'winner', 'win money', 'cash', 'prize', 'urgent',
  'act now', 'click here', 'click below', 'limited time', 'no obligation',
  'risk free', 'risk-free', 'buy now', 'order now', 'subscribe now',
  'earn money', 'make money', 'work from home', 'extra income',
  'get paid', 'double your', 'million dollars', 'credit card',
  'viagra', 'cialis', 'pharmacy', 'porn', 'sex',
  'lowest price', 'cheapest', 'best price', 'save up to',
  'incredible deal', 'once in a lifetime', 'why pay more',
  'satisfaction guaranteed', 'no credit check',
  'weight loss', 'get out of debt',
  'this is not spam', 'not a scam', '100% free', 'no cost',
];

const ALL_CAPS = /\b[A-Z]{5,}\b/g;
const EXCESSIVE_PUNCT = /[!?]{3,}/g;
const MULTI_DOLLAR = /\$\$\$+/;

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&nbsp;/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

export function checkSpam(opts: {
  subject: string;
  html: string;
  text?: string;
  hasUnsubscribe?: boolean;
}): SpamReport {
  const subject = (opts.subject || '').trim();
  const html = opts.html || '';
  const bodyText = (opts.text?.trim() || stripHtml(html)).toLowerCase();
  const issues: SpamIssue[] = [];
  let score = 0;

  // Trigger words
  const triggers: string[] = [];
  for (const w of TRIGGER_WORDS) {
    const lc = w.toLowerCase();
    const inSubject = subject.toLowerCase().includes(lc);
    const inBody = bodyText.includes(lc);
    if (inSubject || inBody) {
      if (!triggers.includes(w)) triggers.push(w);
      if (inSubject) score += 1.5;
      else score += 0.5;
    }
  }
  if (triggers.length > 0) {
    issues.push({
      severity: triggers.length >= 3 ? 'error' : 'warn',
      text: `Spam trigger words detected: ${triggers.slice(0, 8).join(', ')}${triggers.length > 8 ? '…' : ''}`,
    });
  }

  // ALL CAPS in subject
  const capsInSubject = countMatches(subject, ALL_CAPS);
  if (capsInSubject > 0) {
    score += 1;
    issues.push({ severity: 'warn', text: `ALL-CAPS word(s) in subject (${capsInSubject})` });
  }

  // Excessive punctuation
  const punctSubject = countMatches(subject, EXCESSIVE_PUNCT);
  const punctBody = countMatches(html, EXCESSIVE_PUNCT);
  if (punctSubject + punctBody > 0) {
    score += 1;
    issues.push({ severity: 'warn', text: 'Excessive punctuation (!!! or ???)' });
  }

  // $$$ in subject/body
  if (MULTI_DOLLAR.test(subject) || MULTI_DOLLAR.test(html)) {
    score += 1.5;
    issues.push({ severity: 'error', text: 'Multiple $$$ symbols detected' });
  }

  // Subject length
  if (subject.length === 0) {
    score += 5;
    issues.push({ severity: 'error', text: 'Subject is empty' });
  } else if (subject.length < 15) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'Subject is very short (< 15 chars)' });
  } else if (subject.length > 90) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'Subject is long (> 90 chars) — may get cut off' });
  }

  // Body length
  const plainLen = bodyText.length;
  if (plainLen < 40) {
    score += 2;
    issues.push({ severity: 'error', text: 'Email body is very short — looks like a test or spam' });
  } else if (plainLen < 120) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'Email body is short (< 120 chars)' });
  }

  // Links
  const linkCount = (html.match(/<a\b/gi) || []).length;
  if (linkCount > 15) {
    score += 1.5;
    issues.push({ severity: 'error', text: `Too many links (${linkCount}) — flagged by most providers` });
  } else if (linkCount > 8) {
    score += 0.5;
    issues.push({ severity: 'warn', text: `Many links (${linkCount})` });
  }

  // Images
  const imageCount = (html.match(/<img\b/gi) || []).length;
  if (imageCount > 0 && plainLen < 80) {
    score += 2;
    issues.push({ severity: 'error', text: 'Image-only email with little text — high spam risk' });
  }

  // Plain text fallback
  const hasPlain = !!(opts.text && opts.text.trim().length > 0);
  if (!hasPlain) {
    score += 0.5;
    issues.push({ severity: 'warn', text: 'No plain-text fallback provided' });
  }

  // Unsubscribe
  if (opts.hasUnsubscribe === false) {
    score += 1;
    issues.push({ severity: 'warn', text: 'No unsubscribe link — marketing emails should include one' });
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const level: SpamReport['level'] = score < 3 ? 'good' : score < 6 ? 'warn' : 'bad';

  return {
    score,
    level,
    issues,
    stats: {
      subjectLength: subject.length,
      bodyLength: plainLen,
      linkCount,
      imageCount,
      triggers,
    },
  };
}
EOF

# =============================================================
# 3. COMPONENT: SpamCheckModal
# =============================================================

write "src/components/SpamCheckModal.tsx" <<'EOF'
'use client';
import type { SpamReport } from '@/lib/spam';

export default function SpamCheckModal({
  open,
  report,
  busy,
  onCancel,
  onConfirm,
  actionLabel = 'Send anyway',
}: {
  open: boolean;
  report: SpamReport | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  actionLabel?: string;
}) {
  if (!open || !report) return null;

  const color = report.level === 'good' ? '#16A34A' : report.level === 'warn' ? '#D97706' : '#DC2626';
  const bg = report.level === 'good' ? '#DCFCE7' : report.level === 'warn' ? '#FEF3C7' : '#FEE2E2';
  const label =
    report.level === 'good' ? 'Looks good — low spam risk' :
    report.level === 'warn' ? 'Some spam signals detected' :
    'High spam risk — likely to land in spam';

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: bg }}>
          <div>
            <div className="modal-title">Spam quality check</div>
            <div className="modal-sub" style={{ color }}>{label}</div>
          </div>
          <div className="modal-score" style={{ color }}>
            {report.score.toFixed(1)}
            <span className="modal-score-max">/10</span>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-stats">
            <div><span>Subject</span><strong>{report.stats.subjectLength} chars</strong></div>
            <div><span>Body</span><strong>{report.stats.bodyLength} chars</strong></div>
            <div><span>Links</span><strong>{report.stats.linkCount}</strong></div>
            <div><span>Images</span><strong>{report.stats.imageCount}</strong></div>
          </div>

          {report.issues.length === 0 ? (
            <div className="modal-ok">
              ✅ No issues found. Safe to send.
            </div>
          ) : (
            <ul className="modal-issues">
              {report.issues.map((i, idx) => (
                <li key={idx} className={i.severity === 'error' ? 'err' : 'warn'}>
                  <span className="dot" style={{ background: i.severity === 'error' ? '#DC2626' : '#D97706' }} />
                  {i.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Sending…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
EOF

# =============================================================
# 4. PATCH: mailer.ts — force "Startup India Certificate"
# =============================================================

backup "src/lib/mailer.ts"
node - <<'NODE'
const fs = require('fs');
const file = 'src/lib/mailer.ts';
let src = fs.readFileSync(file, 'utf8');

// Add constant at top
if (!src.includes('FORCED_FROM_NAME')) {
  src = src.replace(
    /import\s+\{\s*decrypt\s*\}\s+from\s+'\.\/crypto';/,
    "import { decrypt } from './crypto';\n\nconst FORCED_FROM_NAME = 'Startup India Certificate';"
  );
}

// Override from-name in sendViaSender
const anchor = `  if (sender.paused) throw new Error('Sender paused');
  if (sender.provider === 'hostinger') return sendViaHostinger(sender, msg);
  return sendViaGmail(senderId, msg);`;

const replacement = `  if (sender.paused) throw new Error('Sender paused');

  // Force display name — every email goes out as "Startup India Certificate"
  const emailMatch = msg.from.match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1] : sender.google_email;
  const forcedMsg = { ...msg, from: \`\${FORCED_FROM_NAME} <\${senderEmail}>\` };

  if (sender.provider === 'hostinger') return sendViaHostinger(sender, forcedMsg);
  return sendViaGmail(senderId, forcedMsg);`;

if (src.includes(anchor)) {
  src = src.replace(anchor, replacement);
  fs.writeFileSync(file, src);
  console.log('[patched] mailer.ts — forced from name');
} else {
  console.log('[warn] mailer.ts anchor not found — manual check needed');
}
NODE

# =============================================================
# 5. PATCH: hostinger + google callback default display_name
# =============================================================

if [ -f "src/app/api/senders/hostinger/route.ts" ]; then
  backup "src/app/api/senders/hostinger/route.ts"
  if sed --version >/dev/null 2>&1; then
    sed -i "s|display_name: display_name || email,|display_name: display_name || 'Startup India Certificate',|" "src/app/api/senders/hostinger/route.ts" 2>/dev/null || true
  fi
  node - <<'NODE'
    const fs = require('fs');
    const f = 'src/app/api/senders/hostinger/route.ts';
    if (!fs.existsSync(f)) process.exit(0);
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(
      /display_name:\s*display_name\s*\|\|\s*email\s*,/g,
      "display_name: display_name || 'Startup India Certificate',"
    );
    fs.writeFileSync(f, s);
    console.log('[patched] hostinger route default display_name');
NODE
fi

if [ -f "src/app/api/oauth/google/callback/route.ts" ]; then
  backup "src/app/api/oauth/google/callback/route.ts"
  node - <<'NODE'
    const fs = require('fs');
    const f = 'src/app/api/oauth/google/callback/route.ts';
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(
      /display_name:\s*me\.data\.name\s*\?\?\s*gEmail/g,
      "display_name: 'Startup India Certificate'"
    );
    fs.writeFileSync(f, s);
    console.log('[patched] google callback default display_name');
NODE
fi

# =============================================================
# 6. REPLACE: quick-send page — spam check + confirm
# =============================================================

write "src/app/(app)/quick-send/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import SpamCheckModal from '@/components/SpamCheckModal';
import { checkSpam, type SpamReport } from '@/lib/spam';

type Sender = { id: string; provider?: string; google_email: string; display_name: string | null; status: string; paused: boolean };
const DRAFT_KEY = 'certwinx.quick_send.draft';

export default function QuickSendPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [to, setTo] = useState('');
  const [senderId, setSenderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<p>Hi,</p>\n\n<p>Write your message here.</p>');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; from: string } | null>(null);
  const [report, setReport] = useState<SpamReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { push } = useToast();

  useEffect(() => { fetch('/api/senders', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then(setSenders); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.to) setTo(d.to);
        if (d.senderId) setSenderId(d.senderId);
        if (d.subject) setSubject(d.subject);
        if (d.html) setHtml(d.html);
        if (d.text) setText(d.text);
      }
    } catch {}
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ to, senderId, subject, html, text })); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [to, senderId, subject, html, text]);

  const connected = senders.filter((s) => s.status === 'connected' && !s.paused);

  function openSpamCheck() {
    if (!to.trim()) { push('Add at least one recipient'); return; }
    if (!subject.trim()) { push('Subject is required'); return; }
    if (!html.trim()) { push('Message body is empty'); return; }
    if (connected.length === 0) { push('No connected sender. Go to Senders page.'); return; }
    const r = checkSpam({ subject, html, text, hasUnsubscribe: false });
    setReport(r);
    setModalOpen(true);
  }

  async function reallySend() {
    setModalOpen(false);
    setBusy(true); setResult(null);
    try {
      const r = await fetch('/api/quick-send', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to, sender_account_id: senderId || null, subject, html, text_body: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'send failed');
      setResult({ sent: j.sent, failed: j.failed, from: j.from });
      push(`Sent ${j.sent}, failed ${j.failed}`);
    } catch (e) { push(e instanceof Error ? e.message : 'send failed'); }
    finally { setBusy(false); }
  }

  function clearDraft() {
    if (!confirm('Clear this draft?')) return;
    setTo(''); setSubject(''); setHtml('<p>Hi,</p>\n\n<p>Write your message here.</p>'); setText('');
    localStorage.removeItem(DRAFT_KEY);
  }
  function insertToken(token: string) { setHtml((h) => h + token); }

  return (
    <>
      <div className="topbar">
        <h1>Quick Send</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={clearDraft} disabled={busy}>Clear</button>
          <button className="btn btn-primary" onClick={openSpamCheck} disabled={busy || connected.length === 0}>
            {busy ? 'Sending…' : '📤 Send now'}
          </button>
        </div>
      </div>

      {connected.length === 0 && (
        <div className="card" style={{ marginBottom: 16, background: '#FEF3C7', borderColor: '#FCD34D' }}>
          <strong>⚠️ No connected sender.</strong> Go to <a href="/senders">Senders</a> → Connect a Google or Hostinger account first.
        </div>
      )}
      {result && (
        <div className="card" style={{ marginBottom: 16, background: '#DCFCE7', borderColor: '#86EFAC' }}>
          ✅ Sent <strong>{result.sent}</strong>{result.failed > 0 && <>, ❌ failed <strong>{result.failed}</strong></>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid-2">
          <div className="field"><label>To (comma-separated for multiple)</label>
            <input className="input" placeholder="john@example.com, jane@example.com" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} />
            <small>Max 50 recipients per send. From name will be <strong>Startup India Certificate</strong>.</small>
          </div>
          <div className="field"><label>From sender</label>
            <select className="select" value={senderId} onChange={(e) => setSenderId(e.target.value)} disabled={busy}>
              <option value="">🔄 Auto (least recently used connected sender)</option>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.provider === 'hostinger' ? 'Hostinger' : 'Gmail'}] {s.google_email}{s.paused ? ' (paused)' : ''}{s.status !== 'connected' ? ' [' + s.status + ']' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field"><label>Subject</label>
          <input className="input" placeholder="Your subject line" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p className="card-title" style={{ margin: 0 }}>HTML body</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => insertToken('{{first_name|there}}')} disabled={busy}>{'{{first_name}}'}</button>
              <button className="btn btn-sm" onClick={() => insertToken('{{company_name|your team}}')} disabled={busy}>{'{{company_name}}'}</button>
            </div>
          </div>
          <textarea className="textarea" rows={16} value={html} onChange={(e) => setHtml(e.target.value)} disabled={busy} style={{ minHeight: 320 }} />
          <small>Type HTML or plain text. Unsafe tags are stripped.</small>
        </div>
        <div className="card">
          <p className="card-title">Live preview</p>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#FFF', minHeight: 320, overflow: 'auto', maxHeight: 480 }}
               dangerouslySetInnerHTML={{ __html: html || '<em style="color:#94A3B8">Nothing yet.</em>' }} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">Plain-text fallback (optional)</p>
        <textarea className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="If empty, auto-generated from HTML." disabled={busy} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 40 }}>
        <button className="btn" onClick={clearDraft} disabled={busy}>Clear draft</button>
        <button className="btn btn-primary" onClick={openSpamCheck} disabled={busy || connected.length === 0}>
          {busy ? 'Sending…' : '📤 Send now'}
        </button>
      </div>

      <SpamCheckModal
        open={modalOpen}
        report={report}
        busy={busy}
        onCancel={() => setModalOpen(false)}
        onConfirm={reallySend}
        actionLabel="Send anyway"
      />
    </>
  );
}
EOF

# =============================================================
# 7. REPLACE: campaign detail page — spam check before send
# =============================================================

write "src/app/(app)/campaigns/[id]/page.tsx" <<'EOF'
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import SpamCheckModal from '@/components/SpamCheckModal';
import { checkSpam, type SpamReport } from '@/lib/spam';

type Campaign = { id: string; name: string; subject: string; html: string; text_body: string; status: string; sender_account_id: string | null; scheduled_at: string | null; segment_tags: string[] };
type Sender = { id: string; provider?: string; google_email: string; status: string; paused: boolean };

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Campaign | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [report, setReport] = useState<SpamReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const [cr, sr, pr, cc] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }),
      fetch('/api/senders', { cache: 'no-store' }),
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }),
      fetch('/api/contacts?count=1', { cache: 'no-store' }),
    ]);
    if (cr.ok) setC(await cr.json());
    if (sr.ok) setSenders(await sr.json());
    if (pr.ok) setProgress(await pr.json());
    if (cc.ok) { const j = await cc.json().catch(() => null); if (j && typeof j.count === 'number') setContactCount(j.count); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j) setProgress(j); })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [id]);

  async function save(): Promise<boolean> {
    if (!c) return false;
    const r = await fetch(`/api/campaigns/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id, segment_tags: c.segment_tags, scheduled_at: c.scheduled_at }) });
    return r.ok;
  }

  async function saveOnly() { setBusy(true); const ok = await save(); setBusy(false); push(ok ? 'Saved ✅' : 'Save failed'); }

  async function runAction(a: string) {
    if (!c) return;
    setBusy(true);
    const saved = await save();
    if (!saved) { setBusy(false); push('Could not save campaign before action'); return; }
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      if (a === 'send_now') {
        if ((j.enqueued ?? 0) === 0) push(`No contacts to send. Upload a CSV first.`);
        else push(`⚡ Enqueued ${j.enqueued}. Sending in background — progress updates below.`);
      } else if (a === 'test_send') push('Test email sent ✅');
      else push(`${a} ok${j.count != null ? ` (${j.count})` : ''}`);
      load();
    } else push(j.error || `${a} failed`);
  }

  function requestAction(a: string) {
    if (!c) return;
    if (a === 'send_now' || a === 'test_send') {
      const r = checkSpam({ subject: c.subject, html: c.html, text: c.text_body, hasUnsubscribe: a === 'send_now' });
      setReport(r);
      setPendingAction(a);
      setModalOpen(true);
    } else {
      runAction(a);
    }
  }

  async function uploadCsv(f: File) {
    setImporting(true); const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch('/api/contacts/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'import failed');
      push(`Imported ${j.inserted} contacts (${j.skipped} skipped)`);
      await load();
    } catch (e) { push(e instanceof Error ? e.message : 'import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!c) return <div className="skeleton" style={{ height: 240 }} />;

  const connectedSenders = senders.filter((s) => s.status === 'connected' && !s.paused);
  const hasSender = connectedSenders.length > 0;
  const hasContacts = (contactCount ?? 0) > 0;

  return (
    <>
      <div className="topbar">
        <h1>{c.name}</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn" onClick={saveOnly} disabled={busy}>Save</button>
          <button className="btn" onClick={() => requestAction('test_send')} disabled={busy || !hasSender}>Send test to self</button>
          <button className="btn btn-primary" onClick={() => requestAction('send_now')} disabled={busy || !hasSender || !hasContacts}>{busy ? 'Working…' : '⚡ Send Now'}</button>
          <button className="btn" onClick={() => requestAction('pause')} disabled={busy}>Pause</button>
          <button className="btn" onClick={() => requestAction('resume')} disabled={busy}>Resume</button>
          <button className="btn btn-danger" onClick={() => requestAction('cancel')} disabled={busy}>Cancel</button>
        </div>
      </div>

      {(!hasSender || !hasContacts) && (
        <div className="card" style={{ marginBottom: 20, background: '#FEF3C7', borderColor: '#FCD34D' }}>
          <strong>⚠️ Before you can send:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            {!hasSender && <li><strong>No connected sender.</strong> Go to <a href="/senders">Senders</a> → Connect Google or Hostinger.</li>}
            {!hasContacts && <li><strong>No contacts.</strong> Upload a CSV below (columns: <code>email,first_name,company</code>).</li>}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20, background: '#E6F0FE', borderColor: '#A9D2F1' }}>
        <strong>📌 From name:</strong> All emails sent will appear as <strong>Startup India Certificate</strong> (regardless of sender account).
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <p className="card-title">Compose</p>
          <div className="field"><label>Name</label><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>
          <div className="field"><label>Subject</label><input className="input" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>Sender</label>
            <select className="select" value={c.sender_account_id ?? ''} onChange={(e) => setC({ ...c, sender_account_id: e.target.value || null })}>
              <option value="">🔄 Auto (round-robin — {connectedSenders.length} active)</option>
              {senders.map((s) => (<option key={s.id} value={s.id}>[{s.provider === 'hostinger' ? 'Hostinger' : 'Gmail'}] {s.google_email}{s.paused ? ' (paused)' : ''}</option>))}
            </select>
            <small>From name will always be "Startup India Certificate".</small>
          </div>
          <div className="field"><label>Segment tags (comma separated)</label>
            <input className="input" value={c.segment_tags.join(', ')} onChange={(e) => setC({ ...c, segment_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></div>
          <div className="field"><label>HTML body</label>
            <textarea className="textarea" rows={10} value={c.html} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
          <div className="field"><label>Plain text fallback</label>
            <textarea className="textarea" rows={4} value={c.text_body} onChange={(e) => setC({ ...c, text_body: e.target.value })} /></div>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Recipients (CSV)</p>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>Columns: <code>email,first_name,company</code>.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Uploading…' : '📁 Upload CSV'}</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])} />
              <span style={{ fontSize: 13, color: '#64748B' }}>{contactCount != null ? `${contactCount} contacts in workspace` : '…'}</span>
              <a className="btn btn-sm" href="/contacts">Manage all contacts →</a>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Preview</p>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#F8FAFC', minHeight: 160 }} dangerouslySetInnerHTML={{ __html: c.html || '<em>Nothing yet.</em>' }} />
          </div>
          <div className="card">
            <p className="card-title">Progress</p>
            {progress ? (
              <ul style={{ color: '#334155', fontSize: 14, paddingLeft: 18, margin: 0 }}>
                {Object.entries(progress).map(([k, v]) => (<li key={k}><strong>{k}:</strong> {v}</li>))}
              </ul>
            ) : <div className="skeleton" style={{ height: 40 }} />}
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={load}>🔄 Refresh</button>
          </div>
        </div>
      </div>

      <SpamCheckModal
        open={modalOpen}
        report={report}
        busy={busy}
        onCancel={() => { setModalOpen(false); setPendingAction(null); }}
        onConfirm={() => { if (pendingAction) runAction(pendingAction); setModalOpen(false); }}
        actionLabel={pendingAction === 'test_send' ? 'Send test anyway' : 'Send anyway'}
      />
    </>
  );
}
EOF

# =============================================================
# 8. APPEND: Modal CSS (idempotent)
# =============================================================

MARK="/* CertWinX spam modal v1 */"
if ! grep -qF "$MARK" "src/app/globals.css" 2>/dev/null; then
  cat >> "src/app/globals.css" <<'CSS'

/* CertWinX spam modal v1 */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15,23,42,.55);
  backdrop-filter: blur(4px);
  display: grid; place-items: center; padding: 20px;
  animation: modalFade .15s ease;
}
@keyframes modalFade { from { opacity: 0 } to { opacity: 1 } }
.modal-card {
  width: 100%; max-width: 520px;
  background: #fff; border-radius: 18px; overflow: hidden;
  box-shadow: 0 40px 80px -30px rgba(15,23,42,.5);
  animation: modalUp .2s cubic-bezier(.4,0,.2,1);
  max-height: 90vh; display: flex; flex-direction: column;
}
@keyframes modalUp { from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none } }
.modal-header {
  padding: 22px 24px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  border-bottom: 1px solid rgba(15,23,42,.06);
}
.modal-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
.modal-sub { font-size: 15px; font-weight: 700; margin-top: 4px; }
.modal-score { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.modal-score-max { font-size: 16px; font-weight: 600; opacity: .6; margin-left: 2px; }
.modal-body { padding: 20px 24px; overflow-y: auto; }
.modal-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  padding: 12px; background: #F8FAFC; border-radius: 10px; margin-bottom: 16px;
}
.modal-stats > div { display: flex; flex-direction: column; gap: 2px; text-align: center; }
.modal-stats span { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
.modal-stats strong { font-size: 13.5px; color: #0F172A; }
.modal-ok { padding: 14px 16px; background: #DCFCE7; color: #166534; border-radius: 10px; font-size: 14px; font-weight: 600; }
.modal-issues { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.modal-issues li {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 9px; font-size: 13.5px; line-height: 1.5;
}
.modal-issues li.warn { background: #FEF3C7; color: #78350F; }
.modal-issues li.err { background: #FEE2E2; color: #7F1D1D; }
.modal-issues .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
.modal-actions {
  padding: 16px 24px; border-top: 1px solid #E2E8F0;
  display: flex; justify-content: flex-end; gap: 10px; background: #F8FAFC;
}
CSS
  say "appended spam modal CSS"
fi

# =============================================================
# DONE
# =============================================================

say ""
say "✅ Done."
say ""
say "⚠️ MANUAL STEP (required):"
say "  Supabase → SQL Editor → paste and run:"
say "    supabase/migrations/0004_default_display_name.sql"
say ""
say "Test locally:  npm run dev"
say ""
say "Then push:"
say "  git add . && git commit -m 'force from-name + spam quality check' && git push"