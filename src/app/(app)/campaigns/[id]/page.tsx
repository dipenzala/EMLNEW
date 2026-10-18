/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import * as XLSX from 'xlsx';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [importData, setImportData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState('');
  const [mapName, setMapName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const [cr, cc] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }),
      fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }),
    ]);
    if (cr.ok) setC(await cr.json());
    if (cc.ok) { const j = await cc.json().catch(() => null); if (j && typeof j.count === 'number') setContactCount(j.count); }
  }

  useEffect(() => { load(); }, [id]);

  async function save() {
    if (!c) return false;
    const r = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id }),
    });
    return r.ok;
  }

  async function runAction(a: string) {
    if (!c) return;
    setBusy(true);
    const saved = await save();
    if (!saved) { setBusy(false); push('Could not save campaign'); return; }
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      push(a === 'send_now' ? `⚡ Enqueued ${j.enqueued}. Sending in background…` : 'Success');
      load();
    } else push(j.error || 'Failed');
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
  }

  async function submitMappedData() {
    if (!importData || !mapEmail) { push('Select an Email column'); return; }
    setMappingBusy(true);
    const mapped = importData.map(r => ({
      email: String(r[mapEmail] || '').trim(),
      first_name: mapName ? String(r[mapName] || '').trim() : undefined,
    })).filter(x => x.email.includes('@'));
    
    const r = await fetch(`/api/campaigns/${id}/contacts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contacts: mapped })
    });
    if (r.ok) {
      push('Contacts imported');
      setImportData(null); load();
    } else push('Import failed');
    setMappingBusy(false);
  }

  if (!c) return <div>Loading...</div>;

  return (
    <div>
      <div className="topbar">
        <h1>{c.name}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" onClick={save}>Save</button>
          <button className="btn btn-primary" onClick={() => runAction('send_now')}>⚡ Send Now</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <p className="card-title">Compose</p>
          <div className="field"><label>Subject</label><input className="input" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>HTML</label><textarea className="textarea" style={{ minHeight: 200 }} value={c.html} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
        </div>

        <div className="card">
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
              <button className="btn btn-primary" onClick={submitMappedData} disabled={mappingBusy}>Import</button>
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => setImportData(null)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
