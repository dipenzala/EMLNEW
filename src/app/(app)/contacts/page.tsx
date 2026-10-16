'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

type Contact = { id: string; email: string; first_name?: string | null; company_name?: string | null; tags: string[]; unsubscribed: boolean; created_at: string; };

export default function ContactsPage() {
  const [rows, setRows] = useState<Contact[] | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const r = await fetch(`/api/contacts?q=${encodeURIComponent(q)}&page=${page}`, { cache: 'no-store' });
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, page]);

  async function upload(f: File) {
    setImporting(true);
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch('/api/contacts/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'import failed');
      push(`Imported ${j.inserted} contacts (${j.skipped} skipped)`);
      setPage(1); await load();
    } catch (e) { push(e instanceof Error ? e.message : 'import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <>
      <div className="topbar">
        <h1>Contacts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => (window.location.href = '/api/contacts?export=1')}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 12 }}>
        <input className="input" placeholder="Search email, name, company…" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>

      {!rows ? <div className="skeleton" style={{ height: 60 }} /> :
       rows.length === 0 ? <div className="empty">No contacts yet. Import a CSV to get started.</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Email</th><th>Name</th><th>Company</th><th>Tags</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.email}</td>
                  <td>{c.first_name ?? '—'}</td>
                  <td>{c.company_name ?? '—'}</td>
                  <td>{c.tags?.join(', ') || '—'}</td>
                  <td>{c.unsubscribed ? <span className="badge badge-err">unsub</span> : <span className="badge badge-ok">active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span style={{ padding: '6px 10px', fontSize: 13, color: '#64748B' }}>Page {page}</span>
        <button className="btn btn-sm" onClick={() => setPage(page + 1)} disabled={!rows || rows.length < 50}>Next</button>
      </div>
    </>
  );
}
