#!/usr/bin/env bash
# CertWinX Fix: wrap useSearchParams in Suspense for /welcome
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

backup "src/app/welcome/page.tsx"

write "src/app/welcome/page.tsx" <<'EOF'
'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

function WelcomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const force = params?.get('force') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      const anon = !!(data.user as any)?.is_anonymous;
      setAnonymous(anon);
      if (!anon && data.user) {
        router.replace('/dashboard');
      }
    });
  }, [router]);

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
          text: 'Account saved ✅ Check your inbox to confirm, then sign in normally. Meanwhile your workspace is still a guest.',
        });
        setBusy(false);
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
      setBusy(false);
    }
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

        {force && anonymous ? (
          <p className="welcome-sub" style={{ color: '#92400E' }}>
            ⚠️ To open the dashboard and keep your sender, you must first <strong>save your workspace</strong> below.
            Without it, everything is temporary.
          </p>
        ) : (
          <p className="welcome-sub">
            Your email account is now available in CertWinX. Head to the dashboard to send your first campaign.
          </p>
        )}

        <div className="welcome-actions">
          {!anonymous && (
            <>
              <Link className="btn btn-primary" href="/senders">Go to Senders</Link>
              <Link className="btn" href="/dashboard">Open Dashboard</Link>
            </>
          )}
        </div>

        {anonymous && (
          <div className="welcome-save">
            <div className="welcome-save-head">
              <strong>Save your workspace</strong>
              <span className="badge badge-warn">Required</span>
            </div>
            <p className="welcome-save-sub">
              Add an email and password to keep your sender, campaigns, and data. You&apos;ll then be able to sign in from anywhere.
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
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="welcome-shell">
        <div className="welcome-card">
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    }>
      <WelcomeInner />
    </Suspense>
  );
}
EOF

say ""
say "✅ Welcome page wrapped in Suspense."
say ""
say "Now:"
say "  git add . && git commit -m 'Fix welcome Suspense boundary' && git push"