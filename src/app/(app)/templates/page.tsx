'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type T = { id: string; name: string; subject: string; html: string; text_body: string };

export default function TemplatesPage() {
  const [rows, setRows] = useState<T[] | null>(null);
  const { push } = useToast();
  async function load() { const r = await fetch('/api/templates', { cache: 'no-store' }); if (r.ok) setRows(await r.json()); }
  useEffect(() => { load(); }, []);
  async function create() {
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'New template', subject: '', html: '<p>Hi {{first_name|there}},</p>', text_body: '' }) });
    if (r.ok) load(); else push('Create failed');
  }
  async function del(id: string) {
    if (!confirm('Delete template?')) return;
    const r = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (r.ok) { push('Deleted'); load(); } else push('Failed');
  }
  return (
    <>
      <div className="topbar"><h1>Templates</h1><button className="btn btn-primary" onClick={create}>New template</button></div>
      {!rows ? <div className="skeleton" style={{ height: 60 }} /> :
       rows.length === 0 ? <div className="empty">No templates yet.</div> :
       <div className="grid-3">
         {rows.map((t) => (
           <div key={t.id} className="card">
             <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t.name}</h3>
             <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 12px' }}>{t.subject || '(no subject)'}</p>
             <div style={{ display: 'flex', gap: 6 }}>
               <a className="btn btn-sm" href={`/api/templates/${t.id}`}>View</a>
               <button className="btn btn-sm btn-danger" onClick={() => del(t.id)}>Delete</button>
             </div>
           </div>
         ))}
       </div>
      }
    </>
  );
}
