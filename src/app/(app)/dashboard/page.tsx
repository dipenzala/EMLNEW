/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';

export default function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [statusText, setStatusText] = useState('');
  const isProcessingRef = useRef(false);

  // Load Auto-Mode state on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('certwinx_auto_mode');
    if (savedMode === 'true') setAutoMode(true);
  }, []);

  async function loadStats() {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/dashboard/logs', { cache: 'no-store' }).then(r => r.json())
      ]);
      setM(r1);
      if (Array.isArray(r2)) setHistory(r2);
    } catch (e) {}
  }

  async function triggerGlobalProcess() {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    if (!autoMode) setStatusText('Processing...');
    try {
      const r = await fetch('/api/global-process', { method: 'POST' });
      const j = await r.json();
      if (r.ok) {
        setStatusText(`✅ Sent ${j.totalSent} emails | Retried: ${j.totalFailed}`);
        loadStats();
      } else {
        setStatusText(`❌ Error: ${j.error}`);
      }
    } catch (e) {
      setStatusText('⚠️ Network Error (Retrying...)');
    } finally {
      isProcessingRef.current = false;
    }
  }

  // Auto-Mode Logic (15 seconds interval)
  useEffect(() => {
    if (autoMode) {
      localStorage.setItem('certwinx_auto_mode', 'true');
      triggerGlobalProcess();
      
      const interval = setInterval(() => {
        triggerGlobalProcess();
      }, 15000); // 🔥 15 Seconds

      return () => clearInterval(interval);
    } else {
      localStorage.setItem('certwinx_auto_mode', 'false');
      if (!isProcessingRef.current) setStatusText('Auto-Mode OFF');
    }
  }, [autoMode]);

  useEffect(() => { 
    loadStats(); 
    const t = setInterval(loadStats, 5000); 
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

      {/* Auto-Send Control Panel */}
      <div className="card" style={{ marginBottom: 24, background: '#F8FAFC', borderColor: '#BFDBFE' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>⚡ Global Auto-Send & Retry</h3>
<p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Sends queued emails every 15s. <b>Tab band hone par bhi chalane ke liye:</b> <a href="https://cron-job.org" target="_blank" style={{color: '#1C83F3'}}>cron-job.org</a> par free account banayein aur apne app ke <code>/api/global-process</code> link ko har 5 minute me hit karein.</p>          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: autoMode ? '#16A34A' : '#DC2626' }}>{statusText}</span>
            <button 
              className={`btn ${autoMode ? 'btn-danger' : 'btn-primary'}`} 
              onClick={() => setAutoMode(!autoMode)}
            >
              {autoMode ? '🛑 Stop Auto-Mode' : '▶ Start Auto-Mode'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #1C83F3 0%, #0F2E6E 100%)', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#fff' }}>Sender Capacity</h3>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 15, flexWrap: 'wrap' }}>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>SENDERS</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.active_senders}/{m.total_senders}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>USED</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.used_today}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>REMAINING</p><div style={{ fontSize: 20, fontWeight: 700, color: '#86EFAC' }}>{m.remaining_today}</div></div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Live Send Logs</h2>
          </div>
          <div className="terminal-box" style={{ height: 200 }}>
            {history.length === 0 ? (
              <div>Waiting for emails...</div>
            ) : (
              history.map((h) => (
                <div key={h.id} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>[{new Date(h.created_at).toLocaleTimeString()}]</span>{' '}
                  <span style={{ color: '#00bfff' }}>{h.sender_email}</span>{' '}
                  <span style={{ color: '#00ff00' }}>-&gt; {h.to_email}</span>{' '}
                  <span style={{ color: h.status === 'failed' ? '#ff4444' : '#00ff00' }}>[{h.status.toUpperCase()}]</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
