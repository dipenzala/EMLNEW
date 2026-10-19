/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import * as XLSX from 'xlsx';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  
  // Contact Upload State
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
    const [cr, pr] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]);
    if (cr) setC(cr);
    if (pr) setProgress(pr);
  }

  useEffect(() => { 
    load(); 
    const t = setInterval(load, 3000); // 3s Live Tracking
    return () => clearInterval(t); 
  }, [id]);

  async function save() {
    if (!c) return false;
    const r = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html }),
    });
    return r.ok;
  }

  async function startCampaign() {
    await save();
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send_now' }) });
    if (r.ok) { push('⚡ Bulk Sending Started!'); load(); }
    else push('Failed to start');
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
        if (data.length === 0) throw new Error('Empty file');
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
    if (!importData || !mapEmail) { push('Select Email column'); return; }
    setMappingBusy(true);
    setErrorMsg(null);
    await save(); // Save HTML before uploading

    const mapped = importData.map(r => ({ 
      email: String(r[mapEmail] || '').trim(), 
      first_name: mapName ? String(r[mapName] || '').trim() : undefined 
    })).filter(x => x.email.includes('@'));

    const CHUNK_SIZE = 2000; // Chunk 2000 emails per request
    let total = 0;

    try {
      for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        setUploadProgress(`Uploading ${Math.min(i + CHUNK_SIZE, mapped.length)} / ${mapped.length}...`);

        const r = await fetch(`/api/campaigns/${id}/contacts`, { 
          method: 'POST', headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify({ contacts: chunk }) 
        });
        
        if (!r.ok) {
          const j = await r.json();
          throw new Error(j.error || 'Chunk failed');
        }
        const j = await r.json();
        total += (j.inserted || 0);
      }
      push(`✅ ${total} Contacts imported successfully!`);
      setImportData(null); load();
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed. Check database SQL.');
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
          <button className="btn" onClick={async () => { await save(); push('Saved ✅'); }}>Save</button>
          <button className="btn btn-primary" onClick={startCampaign}>⚡ Start Sending</button>
        </div>
      </div>

      {/* LIVE TRACKING BOX */}
      {progress && progress.total > 0 && (
        <div className="card" style={{ marginBottom: 20, background: '#F8FAFC', borderColor: '#BFDBFE' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>📊 Live Campaign Tracking</h3>
          <div style={{ display: 'flex', gap: 30 }}>
            <div><strong>Total:</strong> {progress.total}</div>
            <div style={{ color: '#D97706' }}><strong>Queued:</strong> {progress.queued}</div>
            <div style={{ color: '#16A34A' }}><strong>Sent:</strong> {progress.accepted}</div>
            <div style={{ color: '#DC2626' }}><strong>Failed:</strong> {progress.failed}</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* COMPOSER (No Templates) */}
        <div className="card">
          <p className="card-title">Compose Email (Direct HTML)</p>
          <div className="field"><label>Subject</label><input className="input" value={c.subject || ''} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field">
            <label>HTML Body</label>
            <textarea className="textarea" style={{ minHeight: 300 }} value={c.html || ''} onChange={(e) => setC({ ...c, html: e.target.value })} placeholder="<p>Hi {{first_name}},</p>" />
          </div>
        </div>

        {/* CONTACTS BULK UPLOAD */}
        <div className="card">
          <p className="card-title">Bulk Contacts (Excel/CSV)</p>
          
          {!importData ? (
            <div style={{ padding: 30, textAlign: 'center', border: '2px dashed #ccc', borderRadius: 8 }}>
              <p style={{ color: '#666', marginBottom: 15 }}>Upload up to 1 Lakh+ contacts</p>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Select File</button>
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
  );
}
