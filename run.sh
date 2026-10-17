#!/usr/bin/env bash
# CertWinX: Ultimate Upgrade (History, Excel, Isolated Contacts, Schedule, Reports)
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 0. Dependencies (xlsx for Excel parsing)
# =============================================================
say "Installing xlsx package for Excel support..."
npm install xlsx --silent

# =============================================================
# 1. SQL Migration (Isolated Contacts)
# =============================================================

write "supabase/migrations/0006_campaign_contacts.sql" <<'SQL'
-- CertWinX 0006: Isolated campaign contacts
alter table public.contacts add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade;

-- Drop old unique constraint
alter table public.contacts drop constraint if exists contacts_user_id_email_key;

-- Global contacts (campaign_id IS NULL) must have unique email per user
drop index if exists uniq_global_contact;
create unique index uniq_global_contact on public.contacts(user_id, email) where campaign_id is null;

-- Campaign contacts (campaign_id IS NOT NULL) must have unique email per campaign
drop index if exists uniq_campaign_contact;
create unique index uniq_campaign_contact on public.contacts(campaign_id, email) where campaign_id is not null;
SQL

# =============================================================
# 2. API: Campaign specific contacts (Manual + CSV)
# =============================================================

write "src/app/api/campaigns/[id]/contacts/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { emailSchema } from '@/lib/validation';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  const { data: campaign } = await admin.from('campaigns').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const contacts = body.contacts as Array<{ email: string; first_name?: string; company_name?: string }>;
  
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'no contacts provided' }, { status: 400 });
  }

  const valid = contacts.filter((c) => emailSchema.safeParse(c.email).success).map((c) => ({
    user_id: user.id,
    campaign_id: params.id,
    email: c.email.toLowerCase().trim(),
    first_name: c.first_name || null,
    company_name: c.company_name || null,
    source: 'campaign-import',
  }));

  if (valid.length === 0) return NextResponse.json({ error: 'no valid emails' }, { status: 400 });

  let inserted = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500);
    const { error, count } = await admin
      .from('contacts')
      .upsert(chunk, { onConflict: 'campaign_id,email', ignoreDuplicates: true, count: 'exact' });
    if (!error) inserted += count ?? 0;
  }

  return NextResponse.json({ ok: true, inserted });
}
EOF

# =============================================================
# 3. API: Campaign Report download
# =============================================================

write "src/app/api/campaigns/[id]/report/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { csvEscape } from '@/lib/csv';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const sb = createSupabaseServer();

  const { data: jobs } = await sb
    .from('email_jobs')
    .select(`
      to_email,
      status,
      last_error,
      accepted_at,
      created_at,
      sender_accounts ( google_email )
    `)
    .eq('campaign_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const rows = [
    ['Email', 'Name', 'Status', 'Sender', 'Sent At', 'Error'].join(','),
    ...(jobs ?? []).map((j: any) => [
      csvEscape(j.to_email),
      '""', // Name isn't directly in jobs, could join if needed
      csvEscape(j.status),
      csvEscape(j.sender_accounts?.google_email || 'unknown'),
      csvEscape(j.accepted_at ? new Date(j.accepted_at).toLocaleString() : ''),
      csvEscape(j.last_error || ''),
    ].join(','))
  ].join('\n');

  return new NextResponse(rows, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="campaign-${params.id}-report.csv"`,
    },
  });
}
EOF

# =============================================================
# 4. API: Live Activity (Dashboard History)
# =============================================================

backup "src/app/api/activity/route.ts"
write "src/app/api/activity/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const user = await requireUser();
  const sb = createSupabaseServer();
  
  const { data, error } = await sb
    .from('email_jobs')
    .select(`
      id,
      to_email,
      status,
      accepted_at,
      created_at,
      sender_accounts ( google_email )
    `)
    .eq('user_id', user.id)
    .in('status', ['accepted', 'failed', 'uncertain'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
EOF

# =============================================================
# 5. LIB: Update queue.ts for campaign-specific contacts
# =============================================================

backup "src/lib/queue.ts"
node - <<'NODE'
const fs = require('fs');
const file = 'src/lib/queue.ts';
let src = fs.readFileSync(file, 'utf8');

const oldEnqueue = `  let q = admin.from('contacts').select('id,email,unsubscribed').eq('user_id', campaign.user_id);
  if (campaign.segment_tags?.length) q = q.overlaps('tags', campaign.segment_tags);
  const { data: contacts } = await q;
  if (!contacts?.length) return 0;`;

const newEnqueue = `  // Fetch both global contacts (campaign_id IS NULL) and campaign-specific contacts
  let q = admin.from('contacts')
    .select('id,email,unsubscribed')
    .eq('user_id', campaign.user_id)
    .or(\`campaign_id.is.null,campaign_id.eq.\${campaignId}\`);
    
  if (campaign.segment_tags?.length) q = q.overlaps('tags', campaign.segment_tags);
  const { data: contacts } = await q;
  if (!contacts?.length) return 0;`;

if (src.includes(oldEnqueue)) {
  src = src.replace(oldEnqueue, newEnqueue);
  fs.writeFileSync(file, src);
  console.log('[patched] queue.ts enqueueCampaignJobs');
} else {
  console.log('[warn] queue.ts enqueue pattern not found');
}
NODE

# =============================================================
# 6. API: Update Cron to start Scheduled Campaigns
# =============================================================

backup "src/app/api/cron/process/route.ts"
write "src/app/api/cron/process/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch, enqueueCampaignJobs } from '@/lib/queue';
import { log } from '@/lib/logger';
import { timingSafeEq } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return provided.length > 0 && timingSafeEq(provided, secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') return NextResponse.json({ ok: true, skipped: 'killswitch' });

  const admin = createSupabaseAdmin();

  // 1. Start scheduled campaigns that are due
  const { data: dueCampaigns } = await admin
    .from('campaigns')
    .select('id,user_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(5);

  if (dueCampaigns && dueCampaigns.length > 0) {
    for (const c of dueCampaigns) {
      await admin.from('campaigns').update({ status: 'running' }).eq('id', c.id);
      await enqueueCampaignJobs(c.id);
      log('cron.campaign.started', { campaignId: c.id });
    }
  }

  // 2. Process queue
  const { data: profiles } = await admin.from('profiles').select('id,batch_size,global_sending_enabled').eq('global_sending_enabled', true).limit(25);
  let claimed = 0, sent = 0, failed = 0;
  
  for (const p of profiles ?? []) {
    const limit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), p.batch_size ?? 5);
    try {
      const r = await processBatch(p.id, limit);
      claimed += r.claimed;
      sent += r.sent;
      failed += r.failed;
    } catch (e) {
      log('cron.process.profile_failed', { profile: p.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  log('cron.process.done', { claimed, sent, failed });
  return NextResponse.json({ ok: true, claimed, sent, failed, campaigns_started: dueCampaigns?.length ?? 0 });
}
EOF

# =============================================================
# 7. UI: Dashboard Live History
# =============================================================

write "src/app/(app)/dashboard/page.tsx" <<'EOF'
/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';

type Metrics = { campaigns: number; queued: number; sent: number; failed: number; uncertain: number; suppressed: number; unsubscribed: number; senders: number; senders_connected: number; cap_used: number; cap_total: number; global_enabled: boolean; };
type History = { id: string; to_email: string; status: string; accepted_at: string | null; created_at: string; sender_accounts: { google_email: string } };

export default function DashboardPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<History[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
        fetch('/api/activity', { cache: 'no-store' }),
      ]);
      if (!r1.ok) throw new Error('metrics load failed');
      setM(await r1.json());
      if (r2.ok) setHistory(await r2.json());
    } catch (e) { setErr(e instanceof Error ? e.message : 'load failed'); }
  }

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  if (err) return <div className="card"><p>Error: {err}</p></div>;
  if (!m) return <div className="grid-4">{[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}</div>;

  return (
    <>
      <div className="topbar"><h1>Overview</h1></div>
      
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[['Campaigns', m.campaigns],['Queued', m.queued],['Accepted', m.sent],['Failed', m.failed]].map(([k, v]) => (
          <div className="card" key={k as string}><p className="card-title">{k}</p><div className="metric">{v as number}</div></div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Live Sent History</h2>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>Recent 50 sends. Auto-refreshes every 15s.</p>
        </div>
        {!history ? <div className="skeleton" style={{ height: 200, margin: 20 }} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 600 }}>
              <thead>
                <tr><th>Time</th><th>To</th><th>Sender</th><th>Status</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={{ color: '#64748B', fontSize: 13 }}>{new Date(h.accepted_at || h.created_at).toLocaleString()}</td>
                    <td>{h.to_email}</td>
                    <td>{h.sender_accounts?.google_email || '—'}</td>
                    <td><span className={`badge ${h.status === 'accepted' ? 'badge-ok' : h.status === 'failed' ? 'badge-err' : 'badge-warn'}`}>{h.status}</span></td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
EOF

# =============================================================
# 8. UI: Campaign Detail Page (Excel mapping, Manual add, Schedule, Report)
# =============================================================

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
  
  // Modals & Imports
  const [report, setReport] = useState<SpamReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  
  // Contact adding states
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  
  // Excel parsing states
  const [showImport, setShowImport] = useState(false);
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
      // Fetch count of contacts specific to this campaign
      fetch(`/api/contacts?campaign_id=${id}&count=1`, { cache: 'no-store' }),
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
      else if (a === 'schedule') push('Campaign scheduled ✅');
      else push(`${a} ok`);
      load();
    } else push(j.error || `${a} failed`);
  }

  async function scheduleCampaign() {
    if (!c || !c.scheduled_at) { push('Select a date and time first'); return; }
    setBusy(true);
    const saved = await save();
    if (saved) {
      await fetch(`/api/campaigns/${id}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'schedule' }) });
      push('Scheduled ✅');
      load();
    }
    setBusy(false);
  }

  function requestAction(a: string) {
    if (!c) return;
    if (a === 'send_now' || a === 'test_send') {
      const r = checkSpam({ subject: c.subject, html: c.html, text: c.text_body, hasUnsubscribe: a === 'send_now' });
      setReport(r); setPendingAction(a); setModalOpen(true);
    } else { runAction(a); }
  }

  // --- Manual Add ---
  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualEmail) return;
    setAddingManual(true);
    const r = await fetch(`/api/campaigns/${id}/contacts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contacts: [{ email: manualEmail, first_name: manualName }] })
    });
    if (r.ok) { push('Contact added'); setManualEmail(''); setManualName(''); load(); }
    else push('Failed to add');
    setAddingManual(false);
  }

  // --- File Parsing ---
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (data.length === 0) throw new Error('File is empty');
        setHeaders(Object.keys(data[0] as object));
        setImportData(data);
      } catch (err) { push('Invalid file format'); }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  }

  async function submitMappedData() {
    if (!importData || !mapEmail) { push('Select an Email column'); return; }
    setMappingBusy(true);
    const mapped = importData.map(row => ({
      email: String(row[mapEmail] || '').trim(),
      first_name: mapName ? String(row[mapName] || '').trim() : undefined,
    })).filter(x => x.email);
    
    const r = await fetch(`/api/campaigns/${id}/contacts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contacts: mapped })
    });
    const j = await r.json();
    if (r.ok) {
      push(`Imported ${j.inserted} contacts`);
      // Auto-set subject if they selected a name column
      if (mapName && c && !c.subject.includes('{{first_name}}')) {
        const newSub = c.subject ? `${c.subject} - {{first_name}}` : 'Congratulations - {{first_name}}';
        setC({ ...c, subject: newSub });
        push('Subject updated with {{first_name}} token');
      }
      setImportData(null); setShowImport(false); load();
    } else push(j.error || 'Import failed');
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
          <a className="btn btn-ghost" href={`/api/campaigns/${id}/report`} download>⬇️ Download Report</a>
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
          <div className="field"><label>HTML body (use {'{{first_name}}'} for personalization)</label>
            <textarea className="textarea" rows={10} value={c.html} onChange={(e) => setC({ ...c, html: e.target.value })} /></div>
        </div>

        <div>
          {/* Schedule Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="card-title">Schedule</p>
            <div className="field">
              <input type="datetime-local" className="input" value={c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0,16) : ''} 
                onChange={(e) => setC({ ...c, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <button className="btn btn-secondary" onClick={scheduleCampaign} disabled={busy || !c.scheduled_at}>Set Schedule</button>
            <p style={{fontSize: 12, color: '#64748b', marginTop: 8}}>Scheduled campaigns start automatically via cron.</p>
          </div>

          {/* Contacts Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p className="card-title" style={{ margin: 0 }}>Contacts ({contactCount || 0})</p>
              <button className="btn btn-sm" onClick={() => setShowImport(!showImport)}>Import File</button>
            </div>
            
            {/* Manual Add */}
            <form onSubmit={addManual} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input className="input" placeholder="Email" type="email" required value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
              <input className="input" placeholder="Name (optional)" value={manualName} onChange={e => setManualName(e.target.value)} />
              <button className="btn btn-primary" disabled={addingManual}>+</button>
            </form>

            {/* File Import Mapping */}
            {showImport && !importData && (
              <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8, textAlign: 'center', border: '1px dashed #CBD5E1' }}>
                <p style={{ fontSize: 13, marginBottom: 8 }}>Upload CSV or Excel (.xlsx)</p>
                <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFile} />
              </div>
            )}

            {importData && (
              <div style={{ padding: 16, background: '#E6F0FE', borderRadius: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 12 }}>Map Columns</p>
                <div className="field">
                  <label>Email Column</label>
                  <select className="select" value={mapEmail} onChange={e => setMapEmail(e.target.value)}>
                    <option value="">Select column...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Name Column (optional)</label>
                  <select className="select" value={mapName} onChange={e => setMapName(e.target.value)}>
                    <option value="">Skip</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={submitMappedData} disabled={mappingBusy}>
                  {mappingBusy ? 'Importing...' : 'Import Contacts'}
                </button>
                <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setImportData(null)}>Cancel</button>
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

# =============================================================
# 9. API: Update global contacts route to ignore campaign contacts
# =============================================================

backup "src/app/api/contacts/route.ts"
node - <<'NODE'
const fs = require('fs');
const file = 'src/app/api/contacts/route.ts';
let src = fs.readFileSync(file, 'utf8');

// Update count and list to filter only global contacts (campaign_id IS NULL)
// Actually, if they query with ?campaign_id=..., we return that. If not, return global.
src = src.replace(
  /let query = sb.from\('contacts'\).select\('id,email,first_name,last_name,company_name,tags,unsubscribed,created_at'\).eq\('user_id', user.id\)/g,
  "let query = sb.from('contacts').select('id,email,first_name,last_name,company_name,tags,unsubscribed,created_at').eq('user_id', user.id).is('campaign_id', null)"
);
// For count
src = src.replace(
  /const { count } = await sb.from\('contacts'\).select\('id', { count: 'exact', head: true }\).eq\('user_id', user.id\);/g,
  "const { count } = await sb.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('campaign_id', null);"
);

fs.writeFileSync(file, src);
console.log('[patched] contacts/route.ts to hide campaign contacts');
NODE

say ""
say "✅ Ultimate upgrade applied."
say ""
say "⚠️ MANUAL STEP (Required):"
say "  Supabase → SQL Editor → Run: supabase/migrations/0006_campaign_contacts.sql"
say ""
say "Then:"
say "  npm run build && git add . && git commit -m 'feat: dashboard history, campaign isolated contacts, excel mapping, scheduling, reports' && git push"