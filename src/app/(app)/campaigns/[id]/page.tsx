/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import * as XLSX from 'xlsx';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [contactCount, setContactCount] = useState<number>(0);
  
  const [importData, setImportData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState('');
  const [mapName, setMapName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function loadCampaign() {
    const r = await fetch(`/api/campaigns/${id}`, { cache: 'no-store' });
    if (r.ok) setC(await r.json());
  }

  async function loadLiveStats() {
    const [pr, cc] = await Promise.all([
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    ]);
    if (pr) setProgress(pr);
    if (cc && typeof cc.count === 'number') setContactCount(cc.count);
  }

  useEffect(() => { 
    loadCampaign(); 
    loadLiveStats();
    const t = setInterval(loadLiveStats, 3000); 
    return () => clearInterval(t); 
  }, [id]);

  async function save() {
    if (!c) return false;
    setBusy(true);
    const r = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html }),
    });
    setBusy(false);
    return r.ok;
  }

  async function processManualQueue() {
    setBusy(true);
    push('⚡ Auto-sending started in background...');
    
    let hasMore = true;
    while (hasMore) {
      try {
        const r = await fetch('/api/process-batch', { method: 'POST' });
        if (!r.ok) throw new Error('Batch failed');
        
        const j = await r.json();
        
        // If nothing was claimed, wait a bit and check again. If queue is empty, stop.
        if (j.claimed === 0) {
          await new Promise(res => setTimeout(res, 5000));
          const stats = await fetch(`/api/campaigns/${id}/progress`).then(res => res.json());
          if (stats.queued === 0) hasMore = false;
        }
        
        loadLiveStats();
        await new Promise(res => setTimeout(res, 200));
      } catch (e) {
        hasMore = false;
      }
    }
    
    setBusy(false);
    push('✅ All queued emails processed!');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
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
        setMapEmail(keys.find(k => /email|mail/i.test(k)) || '');
        setMapName(keys.find(k => /name|first/i.test(k)) || '');
      } catch (err: any) { push(err.message || 'Invalid file.'); }
      finally { setParsing(false); }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submitMappedData() {
    if (!importData || !mapEmail) { push('Email column not detected.'); return; }
    
    const mapped = importData.map(r => ({ email: String(r[mapEmail] || '').trim(), first_name: mapName ? String(r[mapName] || '').trim() : undefined })).filter(x => x.email.includes('@'));
    if (mapped.length === 0) { push('❌ No valid emails found.'); return; }

    setMappingBusy(true);
    await save();
    let totalNew = 0;
    let finalTotal = 0;

    try {
      for (let i = 0; i < mapped.length; i += 500) {
        const chunk = mapped.slice(i, i + 500);
        setUploadProgress(`Importing & Queuing ${Math.min(i + 500, mapped.length)} / ${mapped.length}...`);
        
        const r = await fetch(`/api/campaigns/${id}/contacts`, { 
          method: 'POST', headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify({ contacts: chunk }) 
        });
        
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || 'Server error during chunk import');
        }
        const j = await r.json();
        totalNew += (j.inserted || 0);
        finalTotal = j.totalCount || 0;
      }

      push(`✅ ${totalNew} new imported. Total: ${finalTotal}. Auto-queue started!`);
      setImportData(null); 
      loadLiveStats();
      await processManualQueue(); // Automatically start sending
      
    } catch (err: any) { push(err.message || 'Import failed.'); }
    finally { setUploadProgress(''); setMappingBusy(false); }
  }

  if (!c) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <div>
      <div className="topbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1>{c.name} {c.status === 'running' && <span className="badge badge-ok" style={{marginLeft:10}}>Running</span>}</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn" onClick={async () => { if(await save()) push('Saved ✅'); }} disabled={busy}>Save</button>
          {progress?.queued > 0 && (
            <button className="btn" style={{ background: '#DCFCE7', color: '#166534', fontWeight: 'bold' }} onClick={processManualQueue} disabled={busy}>▶ Auto-Send</button>
          )}
        </div>
      </div>

      {progress && (
        <div className="card" style={{ marginBottom: 20, background: '#F8FAFC', borderColor: '#BFDBFE' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>📊 Live Tracking</h3>
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
            <div><strong>Total Uploaded:</strong> {contactCount}</div>
            <div style={{ color: '#D97706' }}><strong>In Queue:</strong> {progress.queued}</div>
            <div style={{ color: '#16A34A' }}><strong>Sent:</strong> {progress.accepted}</div>
            <div style={{ color: '#DC2626' }}><strong>Failed:</strong> {progress.failed}</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <p className="card-title">Compose Email (HTML)</p>
          <div className="field"><label>Subject</label><input className="input" value={c.subject || ''} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>HTML Body</label><textarea className="textarea" style={{ minHeight: 300 }} value={c.html || ''} onChange={(e) => setC({ ...c, html: e.target.value })} placeholder="<p>Hi {{first_name}},</p>" /></div>
        </div>

        <div className="card">
          <p className="card-title">Bulk Contacts</p>
          {parsing ? (
            <div style={{ padding: 30, textAlign: 'center' }}>⏳ Reading...</div>
          ) : !importData ? (
            <div style={{ padding: 30, textAlign: 'center', border: '2px dashed #ccc', borderRadius: 8 }}>
              <p style={{ color: '#666', marginBottom: 15 }}>Upload contacts (Excel/CSV)</p>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Select File</button>
              <input ref={fileRef} type="file" accept=".csv, .xlsx, .xls" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          ) : (
            <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <h4>Preview ({importData.length} rows)</h4>
              <div style={{ display: 'flex', gap: 10, margin: '10px 0', flexWrap: 'wrap' }}>
                <select className="select" value={mapEmail} onChange={e => setMapEmail(e.target.value)} style={{ background: mapEmail ? '#DCFCE7' : '#fff' }}>
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
                  <button className="btn btn-primary" onClick={submitMappedData} disabled={mappingBusy}>{mappingBusy ? 'Processing...' : `Import & Start Sending`}</button>
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
