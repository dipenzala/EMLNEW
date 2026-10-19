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
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [importData, setImportData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState('');
  const [mapName, setMapName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    try {
      // Use allSettled so one failing API doesn't break the whole page
      const results = await Promise.allSettled([
        fetch(`/api/campaigns/${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
        fetch(`/api/templates`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
        fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value) setC(results[0].value);
      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) setTemplates(results[1].value);
      if (results[2].status === 'fulfilled' && results[2].value?.count !== undefined) setContactCount(results[2].value.count);
      if (results[3].status === 'fulfilled' && results[3].value) setProgress(results[3].value);
    } catch (e) {
      console.log("Load warning:", e);
    }
  }

  useEffect(() => { 
    load(); 
    const t = setInterval(load, 5000); // Slower poll to prevent network drops
    return () => clearInterval(t); 
  }, [id]);

  function applyTemplate(tplId: string) {
    if (!tplId) return;
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

  async function saveOnly() {
    const ok = await save(); 
    push(ok ? 'Campaign Saved ✅' : 'Save failed');
  }

  async function runAction(a: string) {
    if (!c) return;
    await save();
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    if (r.ok) { push(`⚡ Sending started!`); load(); }
    else push('Failed to send');
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
        setErrorMsg(null);
      } catch (err) { push('Invalid file format.'); }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submitMappedData() {
    if (!importData || !mapEmail) { push('Select an Email column'); return; }
    setMappingBusy(true);
    setErrorMsg(null);
    
    // Save current state before upload to prevent template loss
    await save(); 

    const mapped = importData.map(r => ({ 
      email: String(r[mapEmail] || '').trim(), 
      first_name: mapName ? String(r[mapName] || '').trim() : undefined 
    })).filter(x => x.email.includes('@'));

    const CHUNK_SIZE = 1000;
    let totalInserted = 0;

    try {
      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        setUploadProgress(`Importing ${Math.min(i + CHUNK_SIZE, mapped.length)} / ${mapped.length}...`);

        const r = await fetch(`/api/campaigns/${id}/contacts`, { 
          method: 'POST', headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify({ contacts: chunk }) 
        });
        
        const j = await r.json();
        if (!r.ok) {
          setErrorMsg(j.error || 'Import failed on a chunk');
          break; // Stop if DB error occurs
        }
        totalInserted += (j.inserted || 0);
      }

      if (totalInserted > 0) push(`✅ Imported ${totalInserted} contacts`);
      setImportData(null); 
      load();
    } catch (err: any) {
      setErrorMsg('Network error. Please check your connection.');
    } finally {
      setUploadProgress('');
      setMappingBusy(false);
    }
  }

  if (!c) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <div>
      <div className="topbar">
        <h1>{c.name}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" onClick={saveOnly}>Save</button>
          <button className="btn btn-primary" onClick={() => runAction('send_now')}>⚡ Send Now</button>
        </div>
      </div>

      {(c.status === 'running' || progress?.queued > 0) && (
        <div className="card" style={{ marginBottom: 20, background: '#F8FAFC', borderColor: '#BFDBFE' }}>
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
          <p className="card-title">Compose</p>
          
          <div className="field">
            <label>Choose Template</label>
            <select className="select" value={c.template_id || ''} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">-- Select a Template --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {templates.length === 0 && <small style={{ color: 'red' }}>Could not load templates. Refresh page.</small>}
          </div>
          
          <div className="field"><label>Subject</label><input className="input" value={c.subject || ''} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>HTML Body</label><textarea className="textarea" style={{ minHeight: 250 }} value={c.html || ''} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
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
                
                {errorMsg && <div style={{ color: 'red', fontSize: 13, marginBottom: 10, background: '#FEE2E2', padding: 10, borderRadius: 6 }}>{errorMsg}</div>}
                
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
        </div>
      </div>
    </div>
  );
}
