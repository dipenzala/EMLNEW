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
  const [importData, setImportData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState('');
  const [mapName, setMapName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const [cr, tr, cc] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }),
      fetch(`/api/templates`, { cache: 'no-store' }),
      fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }),
    ]);
    if (cr.ok) {
      const data = await cr.json();
      setC(data);
      if (data.scheduled_at) {
        const d = new Date(data.scheduled_at);
        setScheduleDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      }
    }
    if (tr.ok) setTemplates(await tr.json());
    if (cc.ok) { const j = await cc.json().catch(() => null); if (j && typeof j.count === 'number') setContactCount(j.count); }
  }

  useEffect(() => { load(); }, [id]);

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
    const saved = await save();
    if (!saved) { setBusy(false); push('Could not save campaign'); return; }
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { push(a === 'send_now' ? `⚡ Sending started!` : 'Success'); load(); } 
    else push(j.error || 'Failed');
  }

  async function handleSchedule() {
    if (!scheduleDate) { push('Please select a date and time'); return; }
    setBusy(true);
    const isoDate = new Date(scheduleDate).toISOString();
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id, scheduled_at: isoDate }),
    });
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'schedule' }) });
    setBusy(false);
    if (r.ok) push('Campaign Scheduled ✅'); else push('Scheduling failed');
    load();
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
    const mapped = importData.map(r => ({ email: String(r[mapEmail] || '').trim(), first_name: mapName ? String(r[mapName] || '').trim() : undefined })).filter(x => x.email.includes('@'));
    const r = await fetch(`/api/campaigns/${id}/contacts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contacts: mapped }) });
    if (r.ok) { push('Contacts imported'); setImportData(null); load(); }
    else push('Import failed');
    setMappingBusy(false);
  }

  if (!c) return <div className="skeleton" style={{ height: 200 }} />;

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
          
          <div className="field">
            <label>Choose Template</label>
            <select className="select" value={c.template_id || ''} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">-- Select a Template --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="field"><label>Subject</label><input className="input" value={c.subject || ''} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>HTML Body</label><textarea className="textarea" style={{ minHeight: 200 }} value={c.html || ''} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
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
                <button className="btn btn-primary" onClick={submitMappedData} disabled={mappingBusy}>Import</button>
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => setImportData(null)}>Cancel</button>
              </div>
            )}
          </div>

          <div className="card">
            <p className="card-title">Schedule Campaign</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="datetime-local" className="input" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
              <button className="btn btn-primary" onClick={handleSchedule} disabled={busy || !scheduleDate}>Schedule</button>
            </div>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>Campaign will automatically start at the selected time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
