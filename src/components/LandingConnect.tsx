'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Provider = 'gmail' | 'hostinger';

export default function LandingConnect() {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [showHostinger, setShowHostinger] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [hEmail, setHEmail] = useState('');
  const [hPass, setHPass] = useState('');
  const [hName, setHName] = useState('');
  const [hHost, setHHost] = useState('smtp.hostinger.com');
  const [hPort, setHPort] = useState(465);

  async function ensureSession(): Promise<boolean> {
    const sb = createSupabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    if (session) return true;
    const { error } = await sb.auth.signInAnonymously();
    if (error) {
      setMsg({ kind: 'error', text: `Guest session failed: ${error.message}. Enable "Anonymous Sign-ins" in Supabase → Authentication → Sign In / Providers.` });
      return false;
    }
    return true;
  }

  async function connectGmail() {
    setBusy('gmail'); setMsg(null);
    try {
      const ok = await ensureSession();
      if (!ok) { setBusy(null); return; }
      window.location.href = '/api/oauth/google/start?from=landing';
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to start Google connect' });
      setBusy(null);
    }
  }

  async function connectHostinger(e: React.FormEvent) {
    e.preventDefault();
    if (!hEmail || !hPass) { setMsg({ kind: 'error', text: 'Email and password required' }); return; }
    setBusy('hostinger'); setMsg(null);
    try {
      const ok = await ensureSession();
      if (!ok) { setBusy(null); return; }
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
      setMsg({ kind: 'ok', text: 'Hostinger sender connected ✅ Redirecting…' });
      setTimeout(() => { window.location.href = '/welcome'; }, 700);
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'connect failed' });
      setBusy(null);
    }
  }

  return (
    <div className="lc-wrap">
      <div className="lc-cta-row">
        <button className="lc-btn lc-btn-primary" onClick={connectGmail} disabled={busy !== null}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="#fff" d="M21.35 11.1H12v3.2h5.35c-.23 1.3-1.65 3.8-5.35 3.8-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.63 4.5 14.5 3.6 12 3.6 6.98 3.6 2.9 7.68 2.9 12.7s4.08 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.88 0-.6-.07-1.05-.15-1.5l-.23-.32z"/>
          </svg>
          {busy === 'gmail' ? 'Opening Google…' : 'Connect Gmail'}
        </button>
        <button className="lc-btn lc-btn-secondary" onClick={() => setShowHostinger((v) => !v)} disabled={busy !== null}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          {busy === 'hostinger' ? 'Connecting…' : 'Connect Hostinger Mail'}
        </button>
      </div>
      <p className="lc-note">No login needed — a guest workspace is created automatically. You can save your account later.</p>

      {showHostinger && (
        <form onSubmit={connectHostinger} className="lc-form">
          <div className="lc-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hostinger email</label>
              <input className="input" type="email" placeholder="you@yourdomain.com" value={hEmail} onChange={(e) => setHEmail(e.target.value)} disabled={busy !== null} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Mailbox password</label>
              <input className="input" type="password" placeholder="Hostinger mailbox password" value={hPass} onChange={(e) => setHPass(e.target.value)} disabled={busy !== null} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Display name (optional)</label>
              <input className="input" placeholder="Your Name" value={hName} onChange={(e) => setHName(e.target.value)} disabled={busy !== null} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Host / port</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="select" value={hHost} onChange={(e) => setHHost(e.target.value)} disabled={busy !== null}>
                  <option value="smtp.hostinger.com">smtp.hostinger.com</option>
                  <option value="smtp.titan.email">smtp.titan.email</option>
                </select>
                <input className="input" type="number" value={hPort} onChange={(e) => setHPort(Number(e.target.value))} disabled={busy !== null} style={{ maxWidth: 100 }} />
              </div>
            </div>
          </div>
          <button className="lc-btn lc-btn-primary" disabled={busy !== null} type="submit" style={{ marginTop: 14 }}>
            {busy === 'hostinger' ? 'Verifying & connecting…' : 'Connect Hostinger sender'}
          </button>
        </form>
      )}
      {msg && <div className={`lc-msg lc-msg-${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
