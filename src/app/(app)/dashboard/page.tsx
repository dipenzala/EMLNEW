'use client';
import { useEffect, useState } from 'react';

type Metrics = {
  campaigns: number; queued: number; sent: number; failed: number;
  uncertain: number; suppressed: number; unsubscribed: number;
  senders: number; senders_connected: number;
  cap_used: number; cap_total: number; global_enabled: boolean;
};

export default function DashboardPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      setM(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : 'load failed'); }
  }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  if (err) return <div className="card"><p>Error: {err}</p></div>;
  if (!m) return <div className="grid-4">{[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}</div>;

  return (
    <>
      <div className="topbar"><h1>Overview</h1></div>
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[['Uncertain', m.uncertain],['Suppressed', m.suppressed],['Unsubscribed', m.unsubscribed],['Senders connected', `${m.senders_connected}/${m.senders}`]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number | string}</div></div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <p className="card-title">Sender health</p>
          <p style={{ color: '#475569', fontSize: 14 }}>Rolling 24h reservations: <strong>{m.cap_used}</strong> / {m.cap_total} max across senders.</p>
          <p style={{ color: '#475569', fontSize: 14 }}>Global sending: <span className={`badge ${m.global_enabled ? 'badge-ok' : 'badge-warn'}`}>{m.global_enabled ? 'ENABLED' : 'PAUSED'}</span></p>
        </div>
        <div className="card">
          <p className="card-title">Reminder</p>
          <p style={{ color: '#475569', fontSize: 14 }}>“Accepted” means the provider accepted the message for delivery. It is not proof of inbox placement.</p>
        </div>
      </div>
    </>
  );
}
