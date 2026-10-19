/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import * as XLSX from 'xlsx';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [recentContacts, setRecentContacts] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Import states
  const [importData, setImportData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState('');
  const [mapName, setMapName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const [cr, tr, cc, pr] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }),
      fetch(`/api/templates`, { cache: 'no-store' }),
      fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }),
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }),
    ]);
    if (cr.ok) setC(await cr.json());
    if (tr.ok) setTemplates(await tr.json());
    if (cc.ok) { const j = await cc.json().catch(() => null); if (j && typeof j.count === 'number') setContactCount(j.count); }
    if (pr.ok) {
      const p = await pr.json();
      setProgress(p);
      // Fetch recent email statuses for this campaign
      const statusRes = await fetch(`/api/campaigns/${id}/status`, { cache: 'no-store' });
      if (statusRes.ok) setRecentContacts(await statusRes.json());
    }
  }

  useEffect(() => { 
    load(); 
    const t = setInterval(load, 5000); 
    return () => clearInterval(t); 
  }, [id]);

  function applyTemplate(tplId: string) {
    const tpl = templates.find(t => t.id === tplId);
    if (tpl && c) {
      setC({ ...c, subject: tpl.subject, html: tpl.html, text_body: tpl.text_body, template_id: tplId });
      push('Template applied');
    }
  }

  async function save() {
    if (!c) return false;
    const r = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id, template_id: c.template_id }),
    });
    return r.ok;
  }

  async function runAction(a: string) {
    if (!c) return;
    setBusy(true);
    await save();
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { 
      push(a === 'send_now' ? `⚡ Sending started! Enqueued ${j.enqueued || 0} emails.` : 'Success'); 
      load(); 
    }
    else push(j.error || 'Failed');
  }

  async function forceProcess() {
    setBusy(true);
    const r = await fetch('/api/process-batch', { method: 'POST' });
    setBusy(false);
    if (r.ok) { push('Queue processed manually ✅'); load(); }
    else push('Force process failed');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (data.length === 0) throw new Error('Empty');
        setHeaders(Object.keys(data[0] as object));
        setImportData(data);
        const keys = Object.keys(data[0] as object);
        setMapEmail(keys.find(k => k.toLowerCase().includes('email')) || '');
        setMapName(keys.find(k => k.toLowerCase().includes('name')) || '');
      } catch (err) { push('Invalid file format.'); }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submitMappedData() {
    if (!importData || !mapEmail) { push('Select an Email column'); return; }
    setMappingBusy(true);
    
    const mapped = importData.map(r => ({ 
      email: String(r[mapEmail] || '').trim(), 
      first_name: mapName ? String(r[mapName] || '').trim() : undefined 
    })).filter(x => x.email.includes('@'));

    const CHUNK_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
      const chunk = mapped.slice(i, i + CHUNK_SIZE);
      setUploadProgress(`Importing ${Math.min(i + CHUNK_SIZE, mapped.length)} / ${mapped.length}...`);

      const r = await fetch(`/api/campaigns/${id}/contacts`, { 
        method: 'POST', headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify({ contacts: chunk }) 
      });
      
      if (r.ok) {
        const j = await r.json();
        totalInserted += (j.inserted || 0);
      }
    }

    push(`✅ Imported ${totalInserted} contacts`);
    setImportData(null); 
    setUploadProgress('');
    setMappingBusy(false);
    load();
  }

  if (!c) return <div className="skeleton" style={{ height: 200 }} />;

  const isRunning = c.status === 'running' || progress?.queued > 0;

  return (
    <div>
      <div className="topbar">
        <h1>{c.name}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" onClick={save}>Save</button>
          <button className="btn btn-primary" onClick={() => runAction('send_now')} disabled={busy}>⚡ Send Now</button>
        </div>
      </div>

      {/* LIVE PROGRESS TRACKER */}
      {isRunning && (
        <div className="card" style={{ marginBottom: 20, background: '#F8FAFC', borderColor: '#BFDBFE' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>⚡ Live Campaign Progress</h3>
            <button className="btn btn-sm" onClick={forceProcess} disabled={busy}>Force Process Queue</button>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div><strong>Total:</strong> {progress?.total || 0}</div>
            <div style={{ color: '#D97706' }}><strong>Queued:</strong> {progress?.queued || 0}</div>
            <div style={{ color: '#16A34A' }}><strong>Sent:</strong> {progress?.accepted || 0}</div>
            <div style={{ color: '#DC2626' }}><strong>Failed:</strong> {progress?.failed || 0}</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="card-title">Compose</p>
            <button className="btn btn-sm" onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Edit HTML' : 'Preview Email'}</button>
          </div>
          
          <div className="field">
            <label>Choose Template</label>
            <select className="select" value={c.template_id || ''} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">-- Select a Template --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          
          <div className="field"><label>Subject</label><input className="input" value={c.subject || ''} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          
          {showPreview ? (
             <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, minHeight: 250, background: '#fff' }} dangerouslySetInnerHTML={{ __html: c.html || '<p style="color:#999">No HTML content</p>' }} />
          ) : (
            <div className="field"><label>HTML Body</label><textarea className="textarea" style={{ minHeight: 250 }} value={c.html || ''} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Contacts ({contactCount || 0})</p>
            {!importData ? (
              <div style={{ padding: 20, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 8 }}>
                <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Upload Excel/CSV</button>
                <input ref={fileRef} type="file" accept=".csv, .xlsx, .xls" style={{ display: 'none' }} onChange={handleFile} />
              </div>
            ) : (
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                <h4>Preview ({importData.length} rows)</h4>
                <div style={{ display: 'flex', gap: 10, margin: '10px 0' }}>
                  <select className="select" value={mapEmail} onChange={e => setMapEmail(e.target.value)}>
                      <option value="">Email Col...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select className="select" value={mapName} onChange={e => setMapName(e.target.value)}>
                      <option value="">Name Col (Opt)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                {uploadProgress ? (
                  <div style={{ padding: 12, background: '#DBEAFE', color: '#1E40AF', borderRadius: 8, fontWeight: 'bold' }}>⏳ {uploadProgress}</div>
                ) : (
                  <>
                    <button className="btn btn-primary" onClick={submitMappedData} disabled={mappingBusy}>Start Import</button>
                    <button className="btn" style={{ marginLeft: 8 }} onClick={() => setImportData(null)}>Cancel</button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RECENT EMAIL STATUS */}
          {recentContacts.length > 0 && (
            <div className="card">
              <p className="card-title">Recent Email Status</p>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Email</th><th>Status</th></tr></thead>
                  <tbody>
                    {recentContacts.map((rc, i) => (
                      <tr key={i}>
                        <td>{rc.to_email}</td>
                        <td>
                          <span className={`badge ${rc.status === 'accepted' ? 'badge-ok' : rc.status === 'failed' ? 'badge-err' : 'badge-warn'}`}>
                            {rc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
