'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function WelcomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => setAnonymous(!!(data.user as any)?.is_anonymous));
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true); setMsg(null);
    try {
      const sb = createSupabaseBrowser();
      const { error } = await sb.auth.updateUser({ email, password });
      if (error) throw error;
      setMsg({ kind: 'ok', text: 'Account saved ✅ Check your email to confirm, then sign in normally.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally { setBusy(false); }
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
          Your email account is now available in CertWinX. Head to the dashboard to send your first campaign.
        </p>
        <div className="welcome-actions">
          <Link className="btn btn-primary" href="/senders">Go to Senders</Link>
          <Link className="btn" href="/dashboard">Open Dashboard</Link>
        </div>

        {anonymous && (
          <div className="welcome-save">
            <div className="welcome-save-head">
              <strong>Save your workspace</strong>
              <span className="badge badge-warn">Guest</span>
            </div>
            <p className="welcome-save-sub">
              You&apos;re currently signed in as a guest. Add an email and password to keep your sender, campaigns, and data — otherwise everything is temporary.
            </p>
            <form onSubmit={saveAccount} className="welcome-save-form">
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
              <input className="input" type="password" placeholder="Password (min 8 chars)" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy} required />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button>
            </form>
            {msg && <div className={`lc-msg lc-msg-${msg.kind === 'ok' ? 'ok' : 'error'}`}>{msg.text}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
