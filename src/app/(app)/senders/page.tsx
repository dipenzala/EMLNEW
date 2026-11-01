/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function SendersPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function load() {
    const r = await fetch('/api/senders/stats', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      setRows(data.senders || []);
    }
  }
  useEffect(() => { load(); }, []);

  async function reconnectGoogle() {
    window.location.href = '/api/oauth/google/start';
  }

  async function togglePause(s: any) {
    const r = await fetch(`/api/senders/${s.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !s.paused }),
    });
    if (r.ok) { push(s.paused ? 'Resumed' : 'Paused'); load(); }
  }

  if (!rows) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <div>
      <div className="topbar">
        <h1>Sender Accounts</h1>
        <button className="btn btn-primary" onClick={reconnectGoogle}>➕ Connect / Reconnect Google</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr><th>Email</th><th>Status</th><th>Daily Usage</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.google_email}</strong><br/><span className="badge badge-info">{s.provider}</span></td>
                <td>
                  <span className={`badge ${s.status === 'connected' && !s.paused ? 'badge-ok' : 'badge-err'}`}>
                    {s.paused ? 'Paused' : s.status}
                  </span>
                </td>
                <td>{s.stats?.today || 0} / {s.daily_cap}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => togglePause(s)}>{s.paused ? 'Resume' : 'Pause'}</button>
                  
                  {/* 🔥 RECONNECT & VERIFY BUTTON */}
                  {s.provider === 'gmail' && (
                    <button className="btn btn-sm" style={{ background: '#DBEAFE', color: '#1E40AF' }} onClick={reconnectGoogle}>
                      🔄 Reconnect & Verify
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
