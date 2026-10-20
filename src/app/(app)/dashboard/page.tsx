/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()).then(setM).catch(() => {});
      fetch('/api/dashboard/logs', { cache: 'no-store' }).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setHistory(data); else setHistory([]);
      }).catch(() => setHistory([]));
    };
    load();
    const t = setInterval(load, 3000); 
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

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1C83F3 0%, #0F2E6E 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#fff' }}>Sender Capacity</h3>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>SENDERS</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.active_senders}/{m.total_senders}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>USED</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.used_today}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>REMAINING</p><div style={{ fontSize: 20, fontWeight: 700, color: '#86EFAC' }}>{m.remaining_today}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>LIMIT</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.total_capacity}</div></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Live Send Logs</h2>
        </div>
        <div className="terminal-box">
          {history.length === 0 ? (
            <div>Waiting for emails...</div>
          ) : (
            history.map((h) => (
              <div key={h.id} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                <span style={{ color: '#888' }}>[{new Date(h.created_at).toLocaleTimeString()}]</span>{' '}
                <span style={{ color: '#eab308' }}>[{h.campaign_name || 'Unknown'}]</span>{' '}
                <span style={{ color: '#00bfff' }}>{h.sender_email}</span>{' '}
                <span style={{ color: '#00ff00' }}>-&gt; {h.to_email}</span>{' '}
                <span style={{ color: h.status === 'failed' ? '#ff4444' : '#00ff00' }}>[{h.status.toUpperCase()}]</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
