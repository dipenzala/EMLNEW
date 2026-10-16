/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type Sender = {
  id: string; provider?: string; google_email: string; display_name: string | null;
  status: string; paused: boolean; daily_cap: number; last_error: string | null;
  last_used_at: string | null; created_at: string;
};

export default function SendersPage() {
  const [rows, setRows] = useState<Sender[] | null>(null);
  const [showHostinger, setShowHostinger] = useState(false);
  const [hEmail, setHEmail] = useState('');
  const [hPass, setHPass] = useState('');
  const [hName, setHName] = useState('');
  const [hHost, setHHost] = useState('smtp.hostinger.com');
  const [hPort, setHPort] = useState(465);
  const [hBusy, setHBusy] = useState(false);
  const { push } = useToast();

  async function load() {
    const r = await fetch('/api/senders', { cache: 'no-store' });
    if (r.ok) setRows(await r.json()); else push('Failed to load senders');
  }
  useEffect(() => { load(); }, []);

  async function togglePause(s: Sender) {
    const r = await fetch(`/api/senders/${s.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !s.paused }),
    });
    if (r.ok) { push(s.paused ? 'Resumed' : 'Paused'); load(); } else push('Action failed');
  }
  async function disconnect(s: Sender) {
    if (!confirm(`Disconnect ${s.google_email}?`)) return;
    const r = await fetch(`/api/senders/${s.id}`, { method: 'DELETE' });
    if (r.ok) { push('Disconnected'); load(); } else push('Failed');
  }

  async function connectHostinger(e: React.FormEvent) {
    e.preventDefault();
    if (!hEmail || !hPass) { push('Email and password required'); return; }
    setHBusy(true);
    try {
      const r = await fetch('/api/senders/hostinger', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: hEmail, password: hPass,
          display_name: hName || undefined,
          smtp_host: hHost, smtp_port: hPort, smtp_secure: hPort === 465,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'connect failed');
      push('Hostinger sender connected ✅');
      setHEmail(''); setHPass(''); setHName('');
      setShowHostinger(false);
      load();
    } catch (err) { push(err instanceof Error ? err.message : 'connect failed'); }
    finally { setHBusy(false); }
  }

  return (
    <>
      <div className="topbar">
        <h1>Sender accounts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowHostinger((v) => !v)}>
            {showHostinger ? 'Cancel' : '➕ Connect Hostinger Mail'}
          </button>
          <a className="btn btn-primary" href="/api/oauth/google/start">Connect Google account</a>
        </div>
      </div>

      {showHostinger && (
        <form onSubmit={connectHostinger} className="card" style={{ marginBottom: 16 }}>
          <p className="card-title">Connect Hostinger Mail (SMTP + Email Password)</p>
          <div className="grid-2">
            <div className="field">
              <label>Hostinger email</label>
              <input className="input" type="email" placeholder="you@yourdomain.com"
                value={hEmail} onChange={(e) => setHEmail(e.target.value)} disabled={hBusy} required />
            </div>
            <div className="field">
              <label>Email password</label>
              <input className="input" type="password" placeholder="Your mailbox password"
                value={hPass} onChange={(e) => setHPass(e.target.value)} disabled={hBusy} required />
              <small>hPanel → Emails → Email Accounts → wahi password jo mailbox me login karta hai. (Hostinger email service ke saath Titan bhi chalti hai — neeche host dropdown dekho.)</small>
            </div>
            <div className="field">
              <label>Display name (optional)</label>
              <input className="input" placeholder="Your Name"
                value={hName} onChange={(e) => setHName(e.target.value)} disabled={hBusy} />
            </div>
            <div className="field">
              <label>SMTP host / port</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="select" value={hHost} onChange={(e) => setHHost(e.target.value)} disabled={hBusy}>
                  <option value="smtp.hostinger.com">smtp.hostinger.com (Hostinger Email)</option>
                  <option value="smtp.titan.email">smtp.titan.email (Titan Email via Hostinger)</option>
                </select>
                <input className="input" type="number" value={hPort}
                  onChange={(e) => setHPort(Number(e.target.value))} disabled={hBusy}
                  style={{ maxWidth: 100 }} />
              </div>
              <small>465 (SSL) recommended. 587 (STARTTLS) bhi chalta hai.</small>
            </div>
          </div>
          <button className="btn btn-primary" disabled={hBusy}>
            {hBusy ? 'Verifying & connecting…' : 'Connect Hostinger sender'}
          </button>
        </form>
      )}

      {!rows ? <div className="skeleton" style={{ height: 60 }} /> :
       rows.length === 0 ? (
        <div className="empty">
          <p>No senders yet.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <a className="btn btn-primary" href="/api/oauth/google/start">Connect Google account</a>
            <button className="btn" onClick={() => setShowHostinger(true)}>Connect Hostinger Mail</button>
          </div>
          <p style={{ marginTop: 12, fontSize: 12 }}>
            Gmail: needs GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI.<br />
            Hostinger: needs email + password only.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr><th>Email</th><th>Provider</th><th>Status</th><th>Cap</th><th>Last used</th><th>Last error</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.google_email}</td>
                  <td>
                    <span className={`badge ${s.provider === 'hostinger' ? 'badge-warn' : 'badge-info'}`}>
                      {s.provider === 'hostinger' ? 'Hostinger' : 'Gmail'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.status === 'connected' ? 'badge-ok' : 'badge-err'}`}>{s.status}</span>
                    {s.paused && <span className="badge badge-warn" style={{ marginLeft: 6 }}>paused</span>}
                  </td>
                  <td>{s.daily_cap}/24h</td>
                  <td>{s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '—'}</td>
                  <td style={{ maxWidth: 260, color: '#991B1B', fontSize: 12 }}>{s.last_error ?? '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => togglePause(s)}>{s.paused ? 'Resume' : 'Pause'}</button>
                    {s.provider === 'hostinger'
                      ? <button className="btn btn-sm" onClick={() => setShowHostinger(true)}>Reconnect</button>
                      : <a className="btn btn-sm" href="/api/oauth/google/start">Reconnect</a>}
                    <button className="btn btn-sm btn-danger" onClick={() => disconnect(s)}>Disconnect</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
