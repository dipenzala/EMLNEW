'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import SpamCheckModal from '@/components/SpamCheckModal';
import { checkSpam, type SpamReport } from '@/lib/spam';

type Campaign = { id: string; name: string; subject: string; html: string; text_body: string; status: string; sender_account_id: string | null; scheduled_at: string | null; segment_tags: string[] };
type Sender = { id: string; provider?: string; google_email: string; status: string; paused: boolean };

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Campaign | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [report, setReport] = useState<SpamReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const [cr, sr, pr, cc] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }),
      fetch('/api/senders', { cache: 'no-store' }),
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }),
      fetch('/api/contacts?count=1', { cache: 'no-store' }),
    ]);
    if (cr.ok) setC(await cr.json());
    if (sr.ok) setSenders(await sr.json());
    if (pr.ok) setProgress(await pr.json());
    if (cc.ok) { const j = await cc.json().catch(() => null); if (j && typeof j.count === 'number') setContactCount(j.count); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j) setProgress(j); })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [id]);

  async function save(): Promise<boolean> {
    if (!c) return false;
    const r = await fetch(`/api/campaigns/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id, segment_tags: c.segment_tags, scheduled_at: c.scheduled_at }) });
    return r.ok;
  }

  async function saveOnly() { setBusy(true); const ok = await save(); setBusy(false); push(ok ? 'Saved ✅' : 'Save failed'); }

  async function runAction(a: string) {
    if (!c) return;
    setBusy(true);
    const saved = await save();
    if (!saved) { setBusy(false); push('Could not save campaign before action'); return; }
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      if (a === 'send_now') {
        if ((j.enqueued ?? 0) === 0) push(`No contacts to send. Upload a CSV first.`);
        else push(`⚡ Enqueued ${j.enqueued}. Sending in background — progress updates below.`);
      } else if (a === 'test_send') push('Test email sent ✅');
      else push(`${a} ok${j.count != null ? ` (${j.count})` : ''}`);
      load();
    } else push(j.error || `${a} failed`);
  }

  function requestAction(a: string) {
    if (!c) return;
    if (a === 'send_now' || a === 'test_send') {
      const r = checkSpam({ subject: c.subject, html: c.html, text: c.text_body, hasUnsubscribe: a === 'send_now' });
      setReport(r);
      setPendingAction(a);
      setModalOpen(true);
    } else {
      runAction(a);
    }
  }

  async function uploadCsv(f: File) {
    setImporting(true); const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch('/api/contacts/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'import failed');
      push(`Imported ${j.inserted} contacts (${j.skipped} skipped)`);
      await load();
    } catch (e) { push(e instanceof Error ? e.message : 'import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!c) return <div className="skeleton" style={{ height: 240 }} />;

  const connectedSenders = senders.filter((s) => s.status === 'connected' && !s.paused);
  const hasSender = connectedSenders.length > 0;
  const hasContacts = (contactCount ?? 0) > 0;

  return (
    <>
      <div className="topbar">
        <h1>{c.name}</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn" onClick={saveOnly} disabled={busy}>Save</button>
          <button className="btn" onClick={() => requestAction('test_send')} disabled={busy || !hasSender}>Send test to self</button>
          <button className="btn btn-primary" onClick={() => requestAction('send_now')} disabled={busy || !hasSender || !hasContacts}>{busy ? 'Working…' : '⚡ Send Now'}</button>
          <button className="btn" onClick={() => requestAction('pause')} disabled={busy}>Pause</button>
          <button className="btn" onClick={() => requestAction('resume')} disabled={busy}>Resume</button>
          <button className="btn btn-danger" onClick={() => requestAction('cancel')} disabled={busy}>Cancel</button>
        </div>
      </div>

      {(!hasSender || !hasContacts) && (
        <div className="card" style={{ marginBottom: 20, background: '#FEF3C7', borderColor: '#FCD34D' }}>
          <strong>⚠️ Before you can send:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            {!hasSender && <li><strong>No connected sender.</strong> Go to <a href="/senders">Senders</a> → Connect Google or Hostinger.</li>}
            {!hasContacts && <li><strong>No contacts.</strong> Upload a CSV below (columns: <code>email,first_name,company</code>).</li>}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20, background: '#E6F0FE', borderColor: '#A9D2F1' }}>
        <strong>📌 From name:</strong> All emails sent will appear as <strong>Startup India Certificate</strong> (regardless of sender account).
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <p className="card-title">Compose</p>
          <div className="field"><label>Name</label><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>
          <div className="field"><label>Subject</label><input className="input" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>Sender</label>
            <select className="select" value={c.sender_account_id ?? ''} onChange={(e) => setC({ ...c, sender_account_id: e.target.value || null })}>
              <option value="">🔄 Auto (round-robin — {connectedSenders.length} active)</option>
              {senders.map((s) => (<option key={s.id} value={s.id}>[{s.provider === 'hostinger' ? 'Hostinger' : 'Gmail'}] {s.google_email}{s.paused ? ' (paused)' : ''}</option>))}
            </select>
            <small>From name will always be "Startup India Certificate".</small>
          </div>
          <div className="field"><label>Segment tags (comma separated)</label>
            <input className="input" value={c.segment_tags.join(', ')} onChange={(e) => setC({ ...c, segment_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></div>
          <div className="field"><label>HTML body</label>
            <textarea className="textarea" rows={10} value={c.html} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
          <div className="field"><label>Plain text fallback</label>
            <textarea className="textarea" rows={4} value={c.text_body} onChange={(e) => setC({ ...c, text_body: e.target.value })} /></div>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Recipients (CSV)</p>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>Columns: <code>email,first_name,company</code>.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Uploading…' : '📁 Upload CSV'}</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])} />
              <span style={{ fontSize: 13, color: '#64748B' }}>{contactCount != null ? `${contactCount} contacts in workspace` : '…'}</span>
              <a className="btn btn-sm" href="/contacts">Manage all contacts →</a>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Preview</p>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#F8FAFC', minHeight: 160 }} dangerouslySetInnerHTML={{ __html: c.html || '<em>Nothing yet.</em>' }} />
          </div>
          <div className="card">
            <p className="card-title">Progress</p>
            {progress ? (
              <ul style={{ color: '#334155', fontSize: 14, paddingLeft: 18, margin: 0 }}>
                {Object.entries(progress).map(([k, v]) => (<li key={k}><strong>{k}:</strong> {v}</li>))}
              </ul>
            ) : <div className="skeleton" style={{ height: 40 }} />}
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={load}>🔄 Refresh</button>
          </div>
        </div>
      </div>

      <SpamCheckModal
        open={modalOpen}
        report={report}
        busy={busy}
        onCancel={() => { setModalOpen(false); setPendingAction(null); }}
        onConfirm={() => { if (pendingAction) runAction(pendingAction); setModalOpen(false); }}
        actionLabel={pendingAction === 'test_send' ? 'Send test anyway' : 'Send anyway'}
      />
    </>
  );
}
