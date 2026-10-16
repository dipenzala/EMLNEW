'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import SpamCheckModal from '@/components/SpamCheckModal';
import { checkSpam, type SpamReport } from '@/lib/spam';

type Sender = { id: string; provider?: string; google_email: string; display_name: string | null; status: string; paused: boolean };
const DRAFT_KEY = 'certwinx.quick_send.draft';

export default function QuickSendPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [to, setTo] = useState('');
  const [senderId, setSenderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<p>Hi,</p>\n\n<p>Write your message here.</p>');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; from: string } | null>(null);
  const [report, setReport] = useState<SpamReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { push } = useToast();

  useEffect(() => { fetch('/api/senders', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then(setSenders); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.to) setTo(d.to);
        if (d.senderId) setSenderId(d.senderId);
        if (d.subject) setSubject(d.subject);
        if (d.html) setHtml(d.html);
        if (d.text) setText(d.text);
      }
    } catch {}
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ to, senderId, subject, html, text })); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [to, senderId, subject, html, text]);

  const connected = senders.filter((s) => s.status === 'connected' && !s.paused);

  function openSpamCheck() {
    if (!to.trim()) { push('Add at least one recipient'); return; }
    if (!subject.trim()) { push('Subject is required'); return; }
    if (!html.trim()) { push('Message body is empty'); return; }
    if (connected.length === 0) { push('No connected sender. Go to Senders page.'); return; }
    const r = checkSpam({ subject, html, text, hasUnsubscribe: false });
    setReport(r);
    setModalOpen(true);
  }

  async function reallySend() {
    setModalOpen(false);
    setBusy(true); setResult(null);
    try {
      const r = await fetch('/api/quick-send', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to, sender_account_id: senderId || null, subject, html, text_body: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'send failed');
      setResult({ sent: j.sent, failed: j.failed, from: j.from });
      push(`Sent ${j.sent}, failed ${j.failed}`);
    } catch (e) { push(e instanceof Error ? e.message : 'send failed'); }
    finally { setBusy(false); }
  }

  function clearDraft() {
    if (!confirm('Clear this draft?')) return;
    setTo(''); setSubject(''); setHtml('<p>Hi,</p>\n\n<p>Write your message here.</p>'); setText('');
    localStorage.removeItem(DRAFT_KEY);
  }
  function insertToken(token: string) { setHtml((h) => h + token); }

  return (
    <>
      <div className="topbar">
        <h1>Quick Send</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={clearDraft} disabled={busy}>Clear</button>
          <button className="btn btn-primary" onClick={openSpamCheck} disabled={busy || connected.length === 0}>
            {busy ? 'Sending…' : '📤 Send now'}
          </button>
        </div>
      </div>

      {connected.length === 0 && (
        <div className="card" style={{ marginBottom: 16, background: '#FEF3C7', borderColor: '#FCD34D' }}>
          <strong>⚠️ No connected sender.</strong> Go to <a href="/senders">Senders</a> → Connect a Google or Hostinger account first.
        </div>
      )}
      {result && (
        <div className="card" style={{ marginBottom: 16, background: '#DCFCE7', borderColor: '#86EFAC' }}>
          ✅ Sent <strong>{result.sent}</strong>{result.failed > 0 && <>, ❌ failed <strong>{result.failed}</strong></>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid-2">
          <div className="field"><label>To (comma-separated for multiple)</label>
            <input className="input" placeholder="john@example.com, jane@example.com" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} />
            <small>Max 50 recipients per send. From name will be <strong>Startup India Certificate</strong>.</small>
          </div>
          <div className="field"><label>From sender</label>
            <select className="select" value={senderId} onChange={(e) => setSenderId(e.target.value)} disabled={busy}>
              <option value="">🔄 Auto (least recently used connected sender)</option>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.provider === 'hostinger' ? 'Hostinger' : 'Gmail'}] {s.google_email}{s.paused ? ' (paused)' : ''}{s.status !== 'connected' ? ' [' + s.status + ']' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field"><label>Subject</label>
          <input className="input" placeholder="Your subject line" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p className="card-title" style={{ margin: 0 }}>HTML body</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => insertToken('{{first_name|there}}')} disabled={busy}>{'{{first_name}}'}</button>
              <button className="btn btn-sm" onClick={() => insertToken('{{company_name|your team}}')} disabled={busy}>{'{{company_name}}'}</button>
            </div>
          </div>
          <textarea className="textarea" rows={16} value={html} onChange={(e) => setHtml(e.target.value)} disabled={busy} style={{ minHeight: 320 }} />
          <small>Type HTML or plain text. Unsafe tags are stripped.</small>
        </div>
        <div className="card">
          <p className="card-title">Live preview</p>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#FFF', minHeight: 320, overflow: 'auto', maxHeight: 480 }}
               dangerouslySetInnerHTML={{ __html: html || '<em style="color:#94A3B8">Nothing yet.</em>' }} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">Plain-text fallback (optional)</p>
        <textarea className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="If empty, auto-generated from HTML." disabled={busy} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 40 }}>
        <button className="btn" onClick={clearDraft} disabled={busy}>Clear draft</button>
        <button className="btn btn-primary" onClick={openSpamCheck} disabled={busy || connected.length === 0}>
          {busy ? 'Sending…' : '📤 Send now'}
        </button>
      </div>

      <SpamCheckModal
        open={modalOpen}
        report={report}
        busy={busy}
        onCancel={() => setModalOpen(false)}
        onConfirm={reallySend}
        actionLabel="Send anyway"
      />
    </>
  );
}
