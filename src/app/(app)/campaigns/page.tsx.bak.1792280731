'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

type Campaign = { id: string; name: string; subject: string; status: string; scheduled_at: string | null; created_at: string; };

export default function CampaignsPage() {
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const { push } = useToast();

  async function load() {
    const r = await fetch('/api/campaigns', { cache: 'no-store' });
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function createDraft() {
    const r = await fetch('/api/campaigns', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled campaign', subject: 'Hello from CertWinX', html: '<p>Hi {{first_name|there}},</p><p>Write your message here.</p>', text_body: '', segment_tags: [] }),
    });
    if (r.ok) { const j = await r.json(); window.location.href = `/campaigns/${j.id}`; } else push('Failed to create');
  }
  async function duplicate(id: string) {
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'duplicate' }) });
    if (r.ok) { push('Duplicated'); load(); } else push('Failed');
  }
  async function archive(id: string) {
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) });
    if (r.ok) { push('Archived'); load(); } else push('Failed');
  }

  async function del(id: string, name: string) {
    if (!confirm(`Permanently delete "${name}"?\n\nThis removes the campaign AND all its queued/sent jobs. Cannot be undone.`)) return;
    const r = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    if (r.ok) { push('Deleted'); load(); }
    else { const j = await r.json().catch(() => ({})); push(j.error || 'Delete failed'); }
  }

  return (
    <>
      <div className="topbar"><h1>Campaigns</h1><button className="btn btn-primary" onClick={createDraft}>New campaign</button></div>
      {!rows ? <div className="skeleton" style={{ height: 60 }} /> :
       rows.length === 0 ? <div className="empty">No campaigns yet. Click “New campaign” to create one.</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Name</th><th>Subject</th><th>Status</th><th>Scheduled</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/campaigns/${c.id}`}>{c.name}</Link></td>
                  <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</td>
                  <td><span className="badge badge-info">{c.status}</span></td>
                  <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <Link className="btn btn-sm" href={`/campaigns/${c.id}`}>Open</Link>
                    <button className="btn btn-sm" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button className="btn btn-sm" onClick={() => archive(c.id)}>Archive</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(c.id, c.name)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
