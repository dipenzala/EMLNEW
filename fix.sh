#!/usr/bin/env bash
# CertWinX: /welcome — add "Connect another sender" option
set -euo pipefail
say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
[ -f "package.json" ] || { echo "Run from project root."; exit 1; }

backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }
backup "src/app/welcome/page.tsx"

cat > "src/app/welcome/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function WelcomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const force = params?.get('force') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAddMore, setShowAddMore] = useState(false);
  const [hEmail, setHEmail] = useState('');
  const [hPass, setHPass] = useState('');
  const [hName, setHName] = useState('');
  const [hHost, setHHost] = useState('smtp.hostinger.com');
  const [hPort, setHPort] = useState(465);
  const [hBusy, setHBusy] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      const anon = !!(data.user as any)?.is_anonymous;
      setAnonymous(anon);
      if (!anon && data.user && !force) {
        // Real signed-in user with no force flag — nothing to do here.
        // Leave them on this page so they can add more senders or continue.
      }
    });
  }, [force]);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true); setMsg(null);
    try {
      const sb = createSupabaseBrowser();
      const { error } = await sb.auth.updateUser({ email, password });
      if (error) throw error;
      const { data: { session } } = await sb.auth.getSession();
      if (session && !(session.user as any).is_anonymous) {
        setMsg({ kind: 'ok', text: 'Account saved ✅ Taking you to the dashboard…' });
        setTimeout(() => router.replace('/dashboard'), 600);
      } else {
        setMsg({
          kind: 'ok',
          text: 'Account saved ✅ Check your inbox to confirm, then sign in normally.',
        });
        setBusy(false);
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
      setBusy(false);
    }
  }

  async function connectGmail() {
    window.location.href = '/api/oauth/google/start?from=welcome';
  }

  async function connectHostinger(e: React.FormEvent) {
    e.preventDefault();
    if (!hEmail || !hPass) { setMsg({ kind: 'err', text: 'Email and password required' }); return; }
    setHBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/senders/hostinger', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: hEmail, password: hPass,
          display_name: hName || undefined,
          smtp_host: hHost, smtp_port: hPort, smtp_secure: hPort === 465,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'connect failed');
      setMsg({ kind: 'ok', text: 'Hostinger sender added ✅' });
      setHEmail(''); setHPass(''); setHName('');
      setShowAddMore(false);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'connect failed' });
    } finally { setHBusy(false); }
  }

  return (
    <div className="welcome-shell">
      <div className="welcome-card fade-up">
        <div className="welcome-icon">
          <svg viewBox="0 0 52 52" width="52" height="52">
            <circle cx="26" cy="26" r="26" fill="#DCFCE7" />
            <path d="M15 27l8 8 15-15" fill="none" stroke="#166534" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>Sender connected</h1>

        <p className="welcome-sub">
          {force && anonymous
            ? '⚠️ You can add more senders below, or save your workspace to open the dashboard.'
            : 'Your email account is now available in CertWinX.'}
        </p>

        {/* ───── Primary actions ───── */}
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={() => setShowAddMore((v) => !v)}>
            {showAddMore ? 'Cancel' : '➕ Connect another sender'}
          </button>
          {!anonymous && (
            <Link className="btn" href="/dashboard">Open Dashboard</Link>
          )}
          {anonymous && (
            <Link className="btn" href="/senders">View senders (guest)</Link>
          )}
        </div>

        {/* ───── Add another sender panel ───── */}
        {showAddMore && (
          <div className="welcome-save" style={{ animation: 'lc-form-in .22s ease' }}>
            <div className="welcome-save-head">
              <strong>Add another sender</strong>
              <span className="badge badge-info">No login needed</span>
            </div>
            <p className="welcome-save-sub">
              Connect Gmail or Hostinger. You can add as many as you want before saving your workspace.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button className="btn btn-primary" onClick={connectGmail}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path fill="#fff" d="M21.35 11.1H12v3.2h5.35c-.23 1.3-1.65 3.8-5.35 3.8-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.63 4.5 14.5 3.6 12 3.6 6.98 3.6 2.9 7.68 2.9 12.7s4.08 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.88 0-.6-.07-1.05-.15-1.5l-.23-.32z"/>
                </svg>
                Connect Gmail
              </button>
              <button className="btn" onClick={() => setShowAddMore('hostinger' as any)}>
                Connect Hostinger Mail
              </button>
            </div>

            {showAddMore === ('hostinger' as any) && (
              <form onSubmit={connectHostinger} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" type="email" placeholder="you@yourdomain.com"
                  value={hEmail} onChange={(e) => setHEmail(e.target.value)} disabled={hBusy} required />
                <input className="input" type="password" placeholder="Mailbox password"
                  value={hPass} onChange={(e) => setHPass(e.target.value)} disabled={hBusy} required />
                <input className="input" placeholder="Display name (optional)"
                  value={hName} onChange={(e) => setHName(e.target.value)} disabled={hBusy} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="select" value={hHost} onChange={(e) => setHHost(e.target.value)} disabled={hBusy}>
                    <option value="smtp.hostinger.com">smtp.hostinger.com</option>
                    <option value="smtp.titan.email">smtp.titan.email</option>
                  </select>
                  <input className="input" type="number" value={hPort}
                    onChange={(e) => setHPort(Number(e.target.value))} disabled={hBusy} style={{ maxWidth: 100 }} />
                </div>
                <button className="btn btn-primary" disabled={hBusy} type="submit">
                  {hBusy ? 'Verifying…' : 'Connect Hostinger sender'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ───── Save workspace (guest only) ───── */}
        {anonymous && (
          <div className="welcome-save">
            <div className="welcome-save-head">
              <strong>Save your workspace</strong>
              <span className={`badge ${force ? 'badge-warn' : 'badge-info'}`}>
                {force ? 'Required to continue' : 'Recommended'}
              </span>
            </div>
            <p className="welcome-save-sub">
              Add an email and password to keep your senders, campaigns, and data across devices.
            </p>
            <form onSubmit={saveAccount} className="welcome-save-form">
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
              <input className="input" type="password" placeholder="Password (min 8 chars)" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy} required />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & continue'}</button>
            </form>
            {msg && <div className={`lc-msg lc-msg-${msg.kind === 'ok' ? 'ok' : 'error'}`}>{msg.text}</div>}
          </div>
        )}

        {!anonymous && msg && (
          <div className={`lc-msg lc-msg-${msg.kind === 'ok' ? 'ok' : 'error'}`} style={{ marginTop: 18 }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
EOF

say "wrote src/app/welcome/page.tsx"
say ""
say "✅ Done. Restart dev server:"
say "   npm run dev"
say ""
say "Then push:"
say "   git add . && git commit -m 'welcome: add another sender option' && git push"