/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function SendersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHostinger, setShowHostinger] = useState(false);
  const [hEmail, setHEmail] = useState('');
  const [hPass, setHPass] = useState('');
  const [hBusy, setHBusy] = useState(false);
  const { push } = useToast();

  async function load() {
    setLoading(true);
    const r = await fetch('/api/senders/stats', { cache: 'no-store' });
    if (r.ok) setData(await r.json());
    else push('Failed to load sender stats');
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function togglePause(s: any) {
    const r = await fetch(`/api/senders/${s.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !s.paused }),
    });
    if (r.ok) { push(s.paused ? 'Resumed' : 'Paused'); load(); } else push('Action failed');
  }

  async function disconnect(s: any) {
    if (!confirm(`Disconnect ${s.google_email}?`)) return;
    const r = await fetch(`/api/senders/${s.id}`, { method: 'DELETE' });
    if (r.ok) { push('Disconnected'); load(); } else push('Failed');
  }

  async function connectHostinger(e: React.FormEvent) {
    e.preventDefault();
    setHBusy(true);
    try {
      const r = await fetch('/api/senders/hostinger', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: hEmail, password: hPass, smtp_host: 'smtp.hostinger.com', smtp_port: 465, smtp_secure: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'connect failed');
      push('Hostinger sender connected ✅');
      setHEmail(''); setHPass(''); setShowHostinger(false);
      load();
    } catch (err) { push(err instanceof Error ? err.message : 'connect failed'); }
    finally { setHBusy(false); }
  }

  if (loading) return <div className="skeleton" style={{ height: 200 }} />;

  // Filter senders based on search
  const filteredSenders = data?.senders.filter((s: any) => 
    s.google_email.toLowerCase().includes(search.toLowerCase()) || 
    s.provider.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <>
      <div className="topbar">
        <h1>Sender Health & Analytics</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowHostinger((v) => !v)}>➕ Connect Hostinger</button>
          <a className="btn btn-primary" href="/api/oauth/google/start">Connect Google</a>
        </div>
      </div>

      {/* GLOBAL STATS */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <p className="card-title">Active Senders</p>
          <div className="metric">{data?.globalStats.activeSenders || 0} <span style={{ fontSize: 16, color: '#64748B' }}>/ {data?.globalStats.totalSenders || 0}</span></div>
        </div>
        <div className="card">
          <p className="card-title">Total Daily Limit</p>
          <div className="metric">{data?.globalStats.totalCapacity || 0}</div>
        </div>
        <div className="card">
          <p className="card-title">Used Today</p>
          <div className="metric">{data?.globalStats.usedToday || 0}</div>
        </div>
        <div className="card">
          <p className="card-title">Used This Month</p>
          <div className="metric">{data?.globalStats.usedMonth || 0}</div>
        </div>
      </div>

      {showHostinger && (
        <form onSubmit={connectHostinger} className="card" style={{ marginBottom: 16 }}>
          <p className="card-title">Connect Hostinger Mail</p>
          <div className="grid-2">
            <div className="field"><label>Email</label><input className="input" type="email" value={hEmail} onChange={(e) => setHEmail(e.target.value)} required /></div>
            <div className="field"><label>Password</label><input className="input" type="password" value={hPass} onChange={(e) => setHPass(e.target.value)} required /></div>
          </div>
          <button className="btn btn-primary" disabled={hBusy}>{hBusy ? 'Connecting...' : 'Connect'}</button>
        </form>
      )}

      {/* Search Bar for 100+ Senders */}
      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <input 
          className="input" 
          placeholder="Search by email or provider (e.g., gmail, hostinger)..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* SENDERS TABLE */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Sender Email</th>
              <th>Status</th>
              <th>Daily (Used / Limit)</th>
              <th>Weekly</th>
              <th>Monthly</th>
              <th>Total Sent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSenders.map((s: any) => {
              const isActive = s.status === 'connected' && !s.paused;
              return (
                <tr key={s.id}>
                  <td>
                    <strong>{s.google_email}</strong><br/>
                    <span className="badge badge-info" style={{ marginTop: 4 }}>{s.provider.toUpperCase()}</span>
                  </td>
                  <td>
                    <span className={`badge ${isActive ? 'badge-ok' : 'badge-err'}`}>
                      {s.paused ? 'Paused' : s.status}
                    </span>
                  </td>
                  <td><strong>{s.stats.today}</strong> / {s.daily_cap}</td>
                  <td>{s.stats.week}</td>
                  <td>{s.stats.month}</td>
                  <td><strong>{s.stats.total}</strong></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => togglePause(s)}>{s.paused ? 'Resume' : 'Pause'}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => disconnect(s)}>Disconnect</button>
                  </td>
                </tr>
              );
            })}
            {filteredSenders.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>No senders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
