#!/usr/bin/env bash
# CertWinX: Terminal Dashboard + Excel/CSV Upload with Preview
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# 0. Ensure xlsx is installed
say "Checking xlsx dependency..."
npm install xlsx --silent

# 1. Add Terminal CSS to globals.css
MARK="/* CertWinX terminal box */"
if ! grep -qF "$MARK" "src/app/globals.css" 2>/dev/null; then
  cat >> "src/app/globals.css" <<'EOF'

/* CertWinX terminal box */
.terminal-box {
  background: #0a0a0a;
  color: #00ff00;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  padding: 16px;
  border-radius: 8px;
  height: 300px;
  overflow-y: auto;
  border: 1px solid #333;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
  line-height: 1.6;
}
.terminal-box::-webkit-scrollbar { width: 8px; }
.terminal-box::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
.term-green { color: #00ff00; }
.term-time { color: #888; }
.term-sender { color: #00bfff; }
.term-err { color: #ff4444; }
EOF
  say "appended terminal CSS"
fi

# 2. Update Dashboard (Terminal UI)
backup "src/app/(app)/dashboard/page.tsx"
write "src/app/(app)/dashboard/page.tsx" <<'EOF'
/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';

type Metrics = { campaigns: number; queued: number; sent: number; failed: number; uncertain: number; suppressed: number; unsubscribed: number; senders: number; senders_connected: number; cap_used: number; cap_total: number; global_enabled: boolean; };
type History = { id: string; to_email: string; status: string; accepted_at: string | null; created_at: string; sender_accounts: { google_email: string } };

export default function DashboardPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<History[] | null>(null);

  async function load() {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
        fetch('/api/activity', { cache: 'no-store' }),
      ]);
      if (r1.ok) setM(await r1.json());
      if (r2.ok) setHistory(await r2.json());
    } catch (e) {}
  }

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  if (!m) return <div className="skeleton" style={{ height: 90 }} />;

  return (
    <>
      <div className="topbar"><h1>Overview</h1></div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Live Send Logs</h2>
            <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>Terminal view. Updates automatically.</p>
          </div>
          <span className="badge badge-ok">Live</span>
        </div>
        
        <div className="terminal-box">
          {!history ? (
            <div>Connecting to log stream...</div>
          ) : history.length === 0 ? (
            <div>No emails sent yet. Waiting for activity...</div>
          ) : (
            history.map((h) => {
              const time = new Date(h.accepted_at || h.created_at).toLocaleTimeString();
              const status = h.status.toUpperCase();
              const isErr = h.status === 'failed' || h.status === 'uncertain';
              return (
                <div key={h.id} style={{ marginBottom: 4 }}>
                  <span className="term-time">[{time}]</span>{' '}
                  <span className="term-sender">FROM: {h.sender_accounts?.google_email || 'unknown'}</span>{' '}
                  <span className="term-green">-&gt; TO: {h.to_email}</span>{' '}
                  <span className={isErr ? 'term-err' : 'term-green'}>[{status}]</span>
                </div>
              );
            })
          )}
          <div style={{ marginTop: 10, animation: 'pulse-dot 2s infinite' }}>_</div>
        </div>
      </div>
    </>
  );
}
EOF

# 3. Update Campaign Page (Excel/CSV Preview + Removed Manage Link)
backup "src/app/(app)/campaigns/[id]/page.tsx"
write "src/app/(app)/campaigns/[id]/page.tsx" <<'EOF'
/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import SpamCheckModal from '@/components/SpamCheckModal';
import { checkSpam, type SpamReport } from '@/lib/spam';
import * as XLSX from 'xlsx';

type Campaign = { id: string; name: string; subject: string; html: string; text_body: string; status: string; sender_account_id: string | null; scheduled_at: string | null; segment_tags: string[]; };
type Sender = { id: string; provider?: string; google_email: string; status: string; paused: boolean };

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Campaign | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  
  const [report, setReport] = useState<SpamReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  
  // File Import states
  const [importData, setImportData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState('');
  const [mapName, setMapName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  async function load() {
    const [cr, sr, pr, cc] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: 'no-store' }),
      fetch('/api/senders', { cache: 'no-store' }),
      fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }),
      fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }), // only campaign contacts
    ]);
    if (cr.ok) setC(await cr.json());
    if (sr.ok) setSenders(await sr.json());
    if (pr.ok) setProgress(await pr.json());
    if (cc.ok) { const j = await cc.json().catch(() => null); if (j && typeof j.count === 'number') setContactCount(j.count); }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const t = setInterval(() => { fetch(`/api/campaigns/${id}/progress`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j) setProgress(j); }).catch(() => {}); }, 3000);
    return () => clearInterval(t);
  }, [id]);

  async function save(): Promise<boolean> {
    if (!c) return false;
    const r = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: c.name, subject: c.subject, html: c.html, text_body: c.text_body, sender_account_id: c.sender_account_id, segment_tags: c.segment_tags, scheduled_at: c.scheduled_at }),
    });
    return r.ok;
  }

  async function saveOnly() { setBusy(true); const ok = await save(); setBusy(false); push(ok ? 'Saved ✅' : 'Save failed'); }

  async function runAction(a: string) {
    if (!c) return;
    setBusy(true);
    const saved = await save();
    if (!saved) { setBusy(false); push('Could not save campaign'); return; }
    const r = await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      if (a === 'send_now') push((j.enqueued ?? 0) === 0 ? 'No contacts. Add contacts first.' : `⚡ Enqueued ${j.enqueued}. Sending in background…`);
      else if (a === 'test_send') push('Test email sent ✅');
      else push(`${a} ok`);
      load();
    } else push(j.error || `${a} failed`);
  }

  function requestAction(a: string) {
    if (!c) return;
    if (a === 'send_now' || a === 'test_send') {
      const r = checkSpam({ subject: c.subject, html: c.html, text: c.text_body, hasUnsubscribe: a === 'send_now' });
      setReport(r); setPendingAction(a); setModalOpen(true);
    } else { runAction(a); }
  }

  // --- File Parsing ---
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        // Parse both CSV and Excel using xlsx
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        
        if (data.length === 0) throw new Error('File is empty');
        setHeaders(Object.keys(data[0] as object));
        setImportData(data);
        
        // Auto-select columns based on common names
        const keys = Object.keys(data[0] as object);
        const eCol = keys.find(k => k.toLowerCase().includes('email'));
        const nCol = keys.find(k => k.toLowerCase().includes('name'));
        if (eCol) setMapEmail(eCol);
        if (nCol) setMapName(nCol);
        
      } catch (err) { 
        push('Invalid file format. Please upload CSV or Excel.'); 
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  }

  async function submitMappedData() {
    if (!importData || !mapEmail) { push('Please select an Email column'); return; }
    setMappingBusy(true);
    
    // Map and filter valid emails
    const mapped = importData.map(row => ({
      email: String(row[mapEmail] || '').trim(),
      first_name: mapName ? String(row[mapName] || '').trim() : undefined,
    })).filter(x => x.email && x.email.includes('@'));
    
    const r = await fetch(`/api/campaigns/${id}/contacts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contacts: mapped })
    });
    const j = await r.json();
    
    if (r.ok) {
      push(`Imported ${j.inserted} contacts`);
      // Auto-set subject if they selected a name column and subject doesn't have it
      if (mapName && c && !c.subject.includes('{{first_name}}')) {
        const newSub = c.subject ? `${c.subject} - {{first_name}}` : 'Congratulations - {{first_name}}';
        setC({ ...c, subject: newSub });
        push('Subject updated with {{first_name}} token');
      }
      setImportData(null); setMapEmail(''); setMapName(''); load();
    } else {
      push(j.error || 'Import failed');
    }
    setMappingBusy(false);
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
          <button className="btn" onClick={() => requestAction('test_send')} disabled={busy || !hasSender}>Test Send</button>
          <button className="btn btn-primary" onClick={() => requestAction('send_now')} disabled={busy || !hasSender || !hasContacts}>
            {busy ? 'Working…' : '⚡ Send Now'}
          </button>
          <a className="btn btn-ghost" href={`/api/campaigns/${id}/report`} download>⬇️ Report</a>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <p className="card-title">Compose</p>
          <div className="field"><label>Subject</label><input className="input" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} /></div>
          <div className="field"><label>Sender</label>
            <select className="select" value={c.sender_account_id ?? ''} onChange={(e) => setC({ ...c, sender_account_id: e.target.value || null })}>
              <option value="">🔄 Auto (round-robin — {connectedSenders.length} active)</option>
              {senders.map((s) => (<option key={s.id} value={s.id}>[{s.provider === 'hostinger' ? 'Hostinger' : 'Gmail'}] {s.google_email}</option>))}
            </select>
          </div>
          <div className="field"><label>HTML body (use {'{{first_name}}'})</label>
            <textarea className="textarea" rows={10} value={c.html} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Contacts ({contactCount || 0})</p>
            
            {!importData ? (
              <div style={{ padding: 20, background: '#F8FAFC', borderRadius: 8, textAlign: 'center', border: '1px dashed #CBD5E1' }}>
                <p style={{ fontSize: 13, marginBottom: 12, color: '#64748B' }}>Upload CSV or Excel (.xlsx, .xls)</p>
                <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>📁 Select File</button>
                <input ref={fileRef} type="file" accept=".csv, .xlsx, .xls" style={{ display: 'none' }} onChange={handleFile} />
              </div>
            ) : (
              <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 13 }}>Preview File Data ({importData.length} rows)</strong>
                  <button className="btn btn-sm" onClick={() => setImportData(null)}>Cancel</button>
                </div>
                
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table className="table" style={{ fontSize: 12, minWidth: 300 }}>
                    <thead>
                      <tr>{headers.slice(0, 3).map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 3).map((row, i) => (
                        <tr key={i}>{headers.slice(0, 3).map(h => <td key={h}>{String(row[h]).substring(0, 20)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid-2" style={{ marginBottom: 12 }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Email Column (Required)</label>
                    <select className="select" value={mapEmail} onChange={e => setMapEmail(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>Name Column (Optional)</label>
                    <select className="select" value={mapName} onChange={e => setMapName(e.target.value)}>
                      <option value="">Skip</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitMappedData} disabled={mappingBusy}>
                  {mappingBusy ? 'Importing...' : `Import ${importData.length} Contacts`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SpamCheckModal open={modalOpen} report={report} busy={busy} onCancel={() => setModalOpen(false)} onConfirm={() => { if (pendingAction) runAction(pendingAction); setModalOpen(false); }} />
    </>
  );
}
EOF

say ""
say "✅ Terminal Dashboard + File Preview integrated."
say ""
say "Run:"
say "  npm run build"
say "  git add . && git commit -m 'feat: terminal dashboard, excel support, file preview' && git push"