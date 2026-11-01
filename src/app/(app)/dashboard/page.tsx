/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';

export default function DashboardPage() {
  const [m, setM] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [statusText, setStatusText] = useState('Ready');
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('certwinx_auto_mode');
    if (savedMode === 'true') setAutoMode(true);
  }, []);

  async function loadStats() {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/dashboard/logs', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/dashboard/errors', { cache: 'no-store' }).then(r => r.json())
      ]);
      setM(r1);
      if (Array.isArray(r2)) setHistory(r2);
      if (Array.isArray(r3)) setErrors(r3);
    } catch (e) {}
  }

  async function processNow() {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    setStatusText('⚡ Processing batch...');
    try {
      const r = await fetch('/api/process-batch', { method: 'POST' });
      const j = await r.json();
      if (r.ok) {
        setStatusText(`✅ Sent: ${j.sent || 0} | Failed: ${j.failed || 0}`);
        loadStats();
      } else {
        setStatusText(`❌ Error: ${j.error}`);
      }
    } catch (e) {
      setStatusText('⚠️ Network Error');
    } finally {
      isProcessingRef.current = false;
    }
  }

  // Auto-Mode Loop (3 seconds)
  useEffect(() => {
    if (autoMode) {
      localStorage.setItem('certwinx_auto_mode', 'true');
      const loop = setInterval(() => {
        if (!isProcessingRef.current) processNow();
      }, 3000); 
      return () => clearInterval(loop);
    } else {
      localStorage.setItem('certwinx_auto_mode', 'false');
    }
  }, [autoMode]);

  useEffect(() => { 
    loadStats(); 
    const t = setInterval(loadStats, 3000); 
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

      {/* Control Panel */}
      <div className="card" style={{ marginBottom: 24, background: '#F8FAFC', borderColor: '#BFDBFE' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>⚡ Auto-Send Control</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Status: <span style={{ fontWeight: 'bold', color: autoMode ? '#16A34A' : '#DC2626' }}>{statusText}</span></p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={processNow} disabled={isProcessingRef.current}>⚡ Send 10 Now</button>
            <button className={`btn ${autoMode ? 'btn-danger' : 'btn-primary'}`} onClick={() => setAutoMode(!autoMode)}>
              {autoMode ? '🛑 Stop Auto-Send' : '▶ Start Auto-Send'}
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
        {/* Sender Capacity */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #1C83F3 0%, #0F2E6E 100%)', color: '#fff' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#fff' }}>Sender Capacity</h3>
          <div style={{ display: 'flex', gap: 20, marginTop: 15, flexWrap: 'wrap' }}>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>ACTIVE</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.active_senders}/{m.total_senders}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>USED TODAY</p><div style={{ fontSize: 20, fontWeight: 700 }}>{m.used_today}</div></div>
            <div><p style={{ margin: 0, fontSize: 12, color: '#A9D2F1' }}>REMAINING</p><div style={{ fontSize: 20, fontWeight: 700, color: '#86EFAC' }}>{m.remaining_today}</div></div>
          </div>
        </div>

        {/* Live Logs */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Live Send Logs</h2>
          </div>
          <div className="terminal-box" style={{ height: 200 }}>
            {history.length === 0 ? <div>Waiting...</div> : history.map((h) => (
              <div key={h.id} style={{ marginBottom: 4 }}>
                <span style={{ color: '#888' }}>[{new Date(h.created_at).toLocaleTimeString()}]</span>{' '}
                <span style={{ color: '#00bfff' }}>{h.sender_email}</span>{' '}
                <span style={{ color: '#00ff00' }}>-&gt; {h.to_email}</span>{' '}
                <span style={{ color: h.status === 'failed' ? '#ff4444' : '#00ff00' }}>[{h.status.toUpperCase()}]</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🔥 NEW: Live Error Diagnosis Window */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #FCA5A5' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #FCA5A5', background: '#FEF2F2' }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#991B1B' }}>🚨 Live Error Diagnosis</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#B91C1C' }}>Exact reasons why emails are failing or getting stuck.</p>
        </div>
        <div style={{ background: '#0a0a0a', padding: 20, maxHeight: 250, overflowY: 'auto' }}>
          {errors.length === 0 ? (
            <div style={{ color: '#00ff00' }}>No errors found. Emails are sending perfectly!</div>
          ) : (
            errors.map((e) => (
              <div key={e.id} style={{ marginBottom: 8, padding: 8, background: '#1a1a1a', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 }}>
                <div style={{ color: '#ff4444', fontWeight: 'bold' }}>
                  ❌ TO: {e.to_email} (Status: {e.status}, Attempts: {e.attempts})
                </div>
                <div style={{ color: '#fbbf24', marginTop: 4 }}>
                  Error: {e.last_error}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
