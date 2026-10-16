'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

type Row = { id: string; email: string; reason: string; created_at: string };

export default function SuppressionPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();
  async function load() { const r = await fetch('/api/suppression', { cache: 'no-store' }); if (r.ok) setRows(await r.json()); }
  useEffect(() => { load(); }, []);
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch('/api/suppression', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: fd.get('email'), reason: 'manual' }) });
    if (r.ok) { push('Added'); (e.target as HTMLFormElement).reset(); load(); } else push('Failed');
  }
  async function importCsv(f: File) {
    const fd = new FormData(); fd.append('file', f);
    const r = await fetch('/api/suppression/import', { method: 'POST', body: fd });
    const j = await r.json();
    push(r.ok ? `Imported ${j.inserted}` : j.error || 'Failed');
    if (fileRef.current) fileRef.current.value = '';
    load();
  }
  return (
    <>
      <div className="topbar"><h1>Suppression list</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => (window.location.href = '/api/suppression?export=1')}>Export CSV</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        </div>
      </div>
      <form onSubmit={add} className="card" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input name="email" type="email" className="input" placeholder="email@example.com" required />
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      {!rows ? <div className="skeleton" style={{ height: 60 }} /> :
       rows.length === 0 ? <div className="empty">No entries.</div> :
       <div className="card" style={{ padding: 0 }}>
         <table className="table">
           <thead><tr><th>Email</th><th>Reason</th><th>Added</th></tr></thead>
           <tbody>
             {rows.map((r) => (
               <tr key={r.id}><td>{r.email}</td><td><span className="badge badge-muted">{r.reason}</span></td><td>{new Date(r.created_at).toLocaleString()}</td></tr>
             ))}
           </tbody>
         </table>
       </div>
      }
    </>
  );
}
