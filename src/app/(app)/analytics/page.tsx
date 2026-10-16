'use client';
import { useEffect, useState } from 'react';
export default function AnalyticsPage() {
  const [m, setM] = useState<Record<string, number> | null>(null);
  useEffect(() => { fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setM); }, []);
  if (!m) return <div className="skeleton" style={{ height: 80 }} />;
  const unsubRate = m.sent > 0 ? ((m.unsubscribed / m.sent) * 100).toFixed(2) : '0.00';
  return (
    <>
      <div className="topbar"><h1>Analytics</h1></div>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[['Accepted (API)', m.sent],['Failed', m.failed],['Uncertain', m.uncertain]].map(([k, v]) => (
          <div key={k as string} className="card"><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>
      <div className="grid-3">
        {[['Suppressed', m.suppressed],['Unsubscribed', m.unsubscribed],['Unsubscribe rate', `${unsubRate}%`]].map(([k, v]) => (
          <div key={k as string} className="card"><p className="card-title">{k}</p><div className="metric">{v as number | string}</div></div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <p className="card-title">Notes on honesty</p>
        <p style={{ color: '#475569', fontSize: 14 }}>There is no “delivered” or “opened” metric — those require provider events. Treat “Accepted” as the API’s acknowledgement, not proof of inbox placement.</p>
      </div>
    </>
  );
}
