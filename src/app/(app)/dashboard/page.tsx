'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboard').then(r => r.json()).then(setM);
      fetch('/api/activity').then(r => r.json()).then(setHistory);
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!m) return <div>Loading...</div>;

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>
      <div className="card">
        <h2>Live Send Logs</h2>
        <div style={{ background: '#0a0a0a', color: '#00ff00', padding: 16, height: 300, overflowY: 'auto', fontFamily: 'monospace', borderRadius: 8 }}>
          {history?.map(h => (
            <div key={h.id} style={{ marginBottom: 4 }}>
              [{new Date(h.created_at).toLocaleTimeString()}] {h.sender_accounts?.google_email} -&gt; {h.to_email} [{h.status.toUpperCase()}]
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
