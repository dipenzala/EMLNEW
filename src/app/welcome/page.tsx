/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import LandingConnect from '@/components/LandingConnect';

function WelcomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const force = params?.get('force') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAddMore, setShowAddMore] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setAnonymous(!!(data.user as any)?.is_anonymous);
    });
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true); setMsg(null);
    try {
      const sb = createSupabaseBrowser();
      const { error } = await sb.auth.updateUser({ email, password });
      if (error) throw error;
      const { data: { session } } = await sb.auth.getSession();
      if (session && !(session.user as any).is_anonymous) {
        setMsg({ kind: 'ok', text: 'Account saved ✅ Taking you to the dashboard…' });
        setTimeout(() => router.replace('/dashboard'), 600);
      } else {
        setMsg({ kind: 'ok', text: 'Account saved ✅ Check your inbox to confirm.' });
        setBusy(false);
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
      setBusy(false);
    }
  }

  return (
    <div className="wp-shell">
      <style>{`
        .wp-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: #F2F3F4;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .wp-card {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          padding: 32px 24px;
          max-width: 480px;
          width: 100%;
        }
        .wp-icon { display: flex; justify-content: center; margin-bottom: 20px; }
        .wp-title { font-size: 24px; font-weight: 800; margin: 0 0 8px; text-align: center; color: #0F172A; }
        .wp-sub { color: #64748B; font-size: 15px; margin: 0 0 24px; text-align: center; line-height: 1.5; }
        
        .wp-actions { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        @media(min-width: 480px) { .wp-actions { flex-direction: row; } }
        
        .wp-btn { width: 100%; padding: 12px 16px; border-radius: 10px; font-weight: 600; font-size: 15px; text-align: center; border: 1px solid transparent; cursor: pointer; transition: 0.2s; display: inline-flex; justify-content: center; align-items: center; gap: 8px; text-decoration: none; }
        .wp-btn-primary { background: #1C83F3; color: #fff; }
        .wp-btn-primary:hover { background: #1657B8; }
        .wp-btn-outline { background: transparent; color: #0F172A; border-color: #E2E8F0; }
        .wp-btn-outline:hover { background: #F8FAFC; border-color: #CBD5E1; }
        
        .wp-save-box { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 20px; margin-top: 20px; }
        .wp-save-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .wp-save-title { font-weight: 700; font-size: 16px; color: #0F172A; margin: 0; }
        .wp-badge { background: #DBEAFE; color: #1E40AF; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
        .wp-save-sub { color: #475569; font-size: 13.5px; line-height: 1.5; margin: 0 0 16px; }
        
        .wp-input { width: 100%; padding: 12px 14px; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 12px; font-size: 15px; outline: none; }
        .wp-input:focus { border-color: #1C83F3; box-shadow: 0 0 0 3px rgba(28,131,243,0.15); }
        .wp-msg { padding: 12px; border-radius: 8px; font-size: 13.5px; margin-top: 12px; }
        .wp-msg-ok { background: #DCFCE7; color: #166534; }
        .wp-msg-err { background: #FEE2E2; color: #991B1B; }
        
        /* Add Another Sender Animation */
        .wp-add-more-box { margin-top: 16px; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="wp-card">
        <div className="wp-icon">
          <svg viewBox="0 0 52 52" width="52" height="52">
            <circle cx="26" cy="26" r="26" fill="#DCFCE7" />
            <path d="M15 27l8 8 15-15" fill="none" stroke="#166534" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        
        <h1 className="wp-title">Sender connected</h1>
        <p className="wp-sub">Your email account is now available in CertWinX.</p>

        <div className="wp-actions">
          <Link href="/senders" className="wp-btn wp-btn-primary">Go to Senders</Link>
          <Link href="/dashboard" className="wp-btn wp-btn-outline">Dashboard</Link>
        </div>

        {/* NEW: Add Another Sender Button */}
        <button 
          className="wp-btn wp-btn-outline" 
          onClick={() => setShowAddMore(!showAddMore)}
          style={{ marginBottom: 20 }}
        >
          {showAddMore ? 'Cancel' : '+ Add another sender'}
        </button>

        {showAddMore && (
          <div className="wp-add-more-box">
             <LandingConnect />
          </div>
        )}

        {anonymous && !showAddMore && (
          <div className="wp-save-box">
            <div className="wp-save-head">
              <h3 className="wp-save-title">Save your workspace</h3>
              <span className="wp-badge">Recommended</span>
            </div>
            <p className="wp-save-sub">
              Add an email and password to keep your senders, campaigns, and data across devices.
            </p>
            <form onSubmit={saveAccount}>
              <input className="wp-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
              <input className="wp-input" type="password" placeholder="Password (min 8 chars)" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} required />
              <button className="wp-btn wp-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & continue'}</button>
            </form>
            {msg && <div className={`wp-msg wp-msg-${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}>
      <WelcomeInner />
    </Suspense>
  );
}
