'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboard').then(r => r.json()).then(setM).catch(() => {});
      fetch('/api/activity').then(r => r.json()).then(data => {
        // Ensure it's an array before setting
        if (Array.isArray(data)) setHistory(data);
        else setHistory([]);
      }).catch(() => setHistory([]));
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!m) return <div className="skeleton" style={{ height: 100 }} />;

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[['Campaigns', m.campaigns || 0],['Queued', m.queued || 0],['Accepted', m.sent || 0],['Failed', m.failed || 0]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Live Send Logs</h2>
          <span className="badge badge-ok">Live</span>
        </div>
        <div className="terminal-box">
          {!history ? (
            <div>Loading logs...</div>
          ) : history.length === 0 ? (
            <div>No emails sent yet.</div>
          ) : (
            history.map((h) => {
              // Safe checks to prevent crashes
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
