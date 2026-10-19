/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboard').then(r => r.json()).then(setM).catch(() => {});
      fetch('/api/activity').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setHistory(data); else setHistory([]);
      }).catch(() => setHistory([]));
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!m) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <div>
      <div className="topbar">
        <h1>Overview</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748B' }}>Sending: </span>
          <span className={`badge ${m.global_enabled ? 'badge-ok' : 'badge-err'}`}>
            {m.global_enabled ? 'ENABLED' : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* ROW 1: EMAIL STATS */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}>
            <p className="card-title">{k}</p>
            <div className="metric">{v as number}</div>
          </div>
        ))}
      </div>

      {/* ROW 2: SENDER CAPACITY */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1C83F3 0%, #0F2E6E 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#fff' }}>Sender Capacity (24h)</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#A9D2F1' }}>Rolling limit based on connected senders</p>
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#A9D2F1', textTransform: 'uppercase' }}>Senders</p>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{m.active_senders} <span style={{ fontSize: 14, opacity: 0.7 }}>/ {m.total_senders}</span></div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#A9D2F1', textTransform: 'uppercase' }}>Used Today</p>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{m.used_today}</div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#A9D2F1', textTransform: 'uppercase' }}>Remaining</p>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#86EFAC' }}>{m.remaining_today}</div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#A9D2F1', textTransform: 'uppercase' }}>Total Limit</p>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{m.total_capacity}</div>
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.2)', borderRadius: 10, height: 8 }}>
          <div style={{ 
            height: '100%', 
            borderRadius: 10, 
            background: '#86EFAC', 
            width: `${Math.min(100, (m.used_today / (m.total_capacity || 1)) * 100)}%` 
          }} />
        </div>
      </div>

      {/* ROW 3: TERMINAL LOGS */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Live Send Logs</h2>
        </div>
        <div className="terminal-box">
          {!history ? (
            <div>Loading logs...</div>
          ) : history.length === 0 ? (
            <div>No emails sent yet.</div>
          ) : (
            history.map((h) => {
              const time = h.created_at ? new Date(h.created_at).toLocaleTimeString() : 'Unknown Time';
              const sender = h.sender_accounts?.google_email || h.sender_accounts?.[0]?.google_email || 'Unknown Sender';
              const status = h.status ? String(h.status).toUpperCase() : 'UNKNOWN';
              const isErr = status === 'FAILED' || status === 'UNCERTAIN';
              
              return (
                <div key={h.id} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>[{time}]</span>{' '}
                  <span style={{ color: '#00bfff' }}>{sender}</span>{' '}
                  <span style={{ color: '#00ff00' }}>-&gt; {h.to_email}</span>{' '}
                  <span style={{ color: isErr ? '#ff4444' : '#00ff00' }}>[{status}]</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
