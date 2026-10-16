'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
type Settings = { company_name?: string | null; timezone: string; default_sender_id?: string | null; batch_size: number; sender_daily_cap: number; global_sending_enabled: boolean; };
export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const { push } = useToast();
  useEffect(() => { fetch('/api/settings', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setS); }, []);
  async function save() {
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
    if (r.ok) push('Saved'); else push('Save failed');
  }
  async function processBatch() {
    const r = await fetch('/api/process-batch', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) push(`Processed: claimed ${j.claimed ?? 0}, sent ${j.sent ?? 0}`);
    else push(j.error || 'Failed');
  }
  if (!s) return <div className="skeleton" style={{ height: 200 }} />;
  return (
    <>
      <div className="topbar"><h1>Settings</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={processBatch}>Process next batch</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
      <div className="card">
        <div className="field"><label>Company name</label><input className="input" value={s.company_name ?? ''} onChange={(e) => setS({ ...s, company_name: e.target.value })} /></div>
        <div className="field"><label>Timezone</label><input className="input" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} /></div>
        <div className="field"><label>Default sender (ID)</label><input className="input" value={s.default_sender_id ?? ''} onChange={(e) => setS({ ...s, default_sender_id: e.target.value || null })} /></div>
        <div className="field"><label>Batch size (1–50)</label><input className="input" type="number" min={1} max={50} value={s.batch_size} onChange={(e) => setS({ ...s, batch_size: Number(e.target.value) })} /></div>
        <div className="field"><label>Sender daily cap (1–350)</label><input className="input" type="number" min={1} max={350} value={s.sender_daily_cap} onChange={(e) => setS({ ...s, sender_daily_cap: Number(e.target.value) })} /></div>
        <div className="field"><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={s.global_sending_enabled} onChange={(e) => setS({ ...s, global_sending_enabled: e.target.checked })} />Global sending enabled (kill switch)</label></div>
      </div>
    </>
  );
}
