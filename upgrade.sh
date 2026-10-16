#!/usr/bin/env bash
# =============================================================
# CertWinX Premium Upgrade Patch
# Adds: premium landing page, guest connect, welcome flow.
# Keeps: all existing files, migrations, env, data.
# Usage: cd your-project && chmod +x upgrade.sh && ./upgrade.sh
# =============================================================
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

# --- Detect project root ---
[ -f "package.json" ] || die "Run this from your certwinx project root (package.json not found)."
[ -d "src/app" ] || die "src/app not found. Not a Next.js App Router project."
[ -f "src/lib/mailer.ts" ] || die "src/lib/mailer.ts missing. Run the earlier bootstrap first."
[ -f "src/app/api/senders/hostinger/route.ts" ] || die "Hostinger sender route missing. Run the earlier bootstrap first."

ROOT="$(pwd)"
say "Patching project at: $ROOT"

backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }

# =============================================================
# 1. NEW: Landing connect widget (guest sender connect)
# =============================================================

write "src/components/LandingConnect.tsx" <<'EOF'
'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Provider = 'gmail' | 'hostinger';

export default function LandingConnect() {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [showHostinger, setShowHostinger] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [hEmail, setHEmail] = useState('');
  const [hPass, setHPass] = useState('');
  const [hName, setHName] = useState('');
  const [hHost, setHHost] = useState('smtp.hostinger.com');
  const [hPort, setHPort] = useState(465);

  async function ensureSession(): Promise<boolean> {
    const sb = createSupabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    if (session) return true;
    const { error } = await sb.auth.signInAnonymously();
    if (error) {
      setMsg({ kind: 'error', text: `Guest session failed: ${error.message}. Enable "Anonymous Sign-ins" in Supabase → Authentication → Sign In / Providers.` });
      return false;
    }
    return true;
  }

  async function connectGmail() {
    setBusy('gmail'); setMsg(null);
    try {
      const ok = await ensureSession();
      if (!ok) { setBusy(null); return; }
      window.location.href = '/api/oauth/google/start?from=landing';
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to start Google connect' });
      setBusy(null);
    }
  }

  async function connectHostinger(e: React.FormEvent) {
    e.preventDefault();
    if (!hEmail || !hPass) { setMsg({ kind: 'error', text: 'Email and password required' }); return; }
    setBusy('hostinger'); setMsg(null);
    try {
      const ok = await ensureSession();
      if (!ok) { setBusy(null); return; }
      const r = await fetch('/api/senders/hostinger', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: hEmail, password: hPass,
          display_name: hName || undefined,
          smtp_host: hHost, smtp_port: hPort, smtp_secure: hPort === 465,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'connect failed');
      setMsg({ kind: 'ok', text: 'Hostinger sender connected ✅ Redirecting…' });
      setTimeout(() => { window.location.href = '/welcome'; }, 700);
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'connect failed' });
      setBusy(null);
    }
  }

  return (
    <div className="lc-wrap">
      <div className="lc-cta-row">
        <button className="lc-btn lc-btn-primary" onClick={connectGmail} disabled={busy !== null}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="#fff" d="M21.35 11.1H12v3.2h5.35c-.23 1.3-1.65 3.8-5.35 3.8-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.63 4.5 14.5 3.6 12 3.6 6.98 3.6 2.9 7.68 2.9 12.7s4.08 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.88 0-.6-.07-1.05-.15-1.5l-.23-.32z"/>
          </svg>
          {busy === 'gmail' ? 'Opening Google…' : 'Connect Gmail'}
        </button>
        <button className="lc-btn lc-btn-secondary" onClick={() => setShowHostinger((v) => !v)} disabled={busy !== null}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          {busy === 'hostinger' ? 'Connecting…' : 'Connect Hostinger Mail'}
        </button>
      </div>
      <p className="lc-note">No login needed — a guest workspace is created automatically. You can save your account later.</p>

      {showHostinger && (
        <form onSubmit={connectHostinger} className="lc-form">
          <div className="lc-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hostinger email</label>
              <input className="input" type="email" placeholder="you@yourdomain.com" value={hEmail} onChange={(e) => setHEmail(e.target.value)} disabled={busy !== null} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Mailbox password</label>
              <input className="input" type="password" placeholder="Hostinger mailbox password" value={hPass} onChange={(e) => setHPass(e.target.value)} disabled={busy !== null} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Display name (optional)</label>
              <input className="input" placeholder="Your Name" value={hName} onChange={(e) => setHName(e.target.value)} disabled={busy !== null} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Host / port</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="select" value={hHost} onChange={(e) => setHHost(e.target.value)} disabled={busy !== null}>
                  <option value="smtp.hostinger.com">smtp.hostinger.com</option>
                  <option value="smtp.titan.email">smtp.titan.email</option>
                </select>
                <input className="input" type="number" value={hPort} onChange={(e) => setHPort(Number(e.target.value))} disabled={busy !== null} style={{ maxWidth: 100 }} />
              </div>
            </div>
          </div>
          <button className="lc-btn lc-btn-primary" disabled={busy !== null} type="submit" style={{ marginTop: 14 }}>
            {busy === 'hostinger' ? 'Verifying & connecting…' : 'Connect Hostinger sender'}
          </button>
        </form>
      )}
      {msg && <div className={`lc-msg lc-msg-${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
EOF

# =============================================================
# 2. NEW: Welcome page (post-connect + save account)
# =============================================================

write "src/app/welcome/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function WelcomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => setAnonymous(!!(data.user as any)?.is_anonymous));
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true); setMsg(null);
    try {
      const sb = createSupabaseBrowser();
      const { error } = await sb.auth.updateUser({ email, password });
      if (error) throw error;
      setMsg({ kind: 'ok', text: 'Account saved ✅ Check your email to confirm, then sign in normally.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally { setBusy(false); }
  }

  return (
    <div className="welcome-shell">
      <div className="welcome-card fade-up">
        <div className="welcome-icon">
          <svg viewBox="0 0 52 52" width="52" height="52">
            <circle cx="26" cy="26" r="26" fill="#DCFCE7" />
            <path d="M15 27l8 8 15-15" fill="none" stroke="#166534" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>Sender connected</h1>
        <p className="welcome-sub">
          Your email account is now available in CertWinX. Head to the dashboard to send your first campaign.
        </p>
        <div className="welcome-actions">
          <Link className="btn btn-primary" href="/senders">Go to Senders</Link>
          <Link className="btn" href="/dashboard">Open Dashboard</Link>
        </div>

        {anonymous && (
          <div className="welcome-save">
            <div className="welcome-save-head">
              <strong>Save your workspace</strong>
              <span className="badge badge-warn">Guest</span>
            </div>
            <p className="welcome-save-sub">
              You&apos;re currently signed in as a guest. Add an email and password to keep your sender, campaigns, and data — otherwise everything is temporary.
            </p>
            <form onSubmit={saveAccount} className="welcome-save-form">
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
              <input className="input" type="password" placeholder="Password (min 8 chars)" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy} required />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button>
            </form>
            {msg && <div className={`lc-msg lc-msg-${msg.kind === 'ok' ? 'ok' : 'error'}`}>{msg.text}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
EOF

# =============================================================
# 3. REPLACE: Premium landing page
# =============================================================

backup "src/app/page.tsx"

write "src/app/page.tsx" <<'EOF'
import Link from 'next/link';
import LandingConnect from '@/components/LandingConnect';

export default function LandingPage() {
  return (
    <>
      <header className="landing-header">
        <div className="container landing-header-inner">
          <Link href="/" className="landing-logo">
            <span className="landing-logo-mark">C</span>
            <span>CertWinX</span>
          </Link>
          <nav className="landing-nav">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="landing-nav-cta">
            <Link className="btn btn-sm" href="/login">Sign in</Link>
            <Link className="btn btn-primary btn-sm" href="/signup">Sign up free</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="container landing-hero-grid">
          <div className="landing-hero-copy fade-up">
            <span className="landing-eyebrow">
              <span className="landing-eyebrow-dot" />
              Connect in 60 seconds · No login required
            </span>
            <h1>
              Send email campaigns from <span className="gradient-text">your own mailbox</span>.
            </h1>
            <p className="landing-lead">
              CertWinX is a self-hosted email campaign manager for teams that send from their
              own <strong>Gmail</strong> or <strong>Hostinger Mail</strong> account. No third-party
              relay, no spoofed senders, no fake deliverability promises.
            </p>
            <LandingConnect />
            <div className="landing-trust">
              <span className="landing-trust-item">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="#16A34A"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.707 6.293a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                OAuth 2.0 &amp; App passwords
              </span>
              <span className="landing-trust-item">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="#16A34A"><path d="M10 2L3 5v5c0 4.418 3.582 8 8 8s8-3.582 8-8V5l-7-3z"/></svg>
                AES-256-GCM encrypted
              </span>
              <span className="landing-trust-item">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="#16A34A"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>
                Self-hosted · Your data
              </span>
            </div>
          </div>

          <div className="landing-hero-visual fade-up fade-up-delay-1">
            <div className="preview-card">
              <div className="preview-card-header">
                <span className="preview-dot" style={{ background: '#FF5F57' }} />
                <span className="preview-dot" style={{ background: '#FEBC2E' }} />
                <span className="preview-dot" style={{ background: '#28C840' }} />
                <span className="preview-title">certwinx.app / senders</span>
              </div>
              <div className="preview-card-body">
                <div className="preview-row">
                  <div className="preview-avatar" style={{ background: '#DBEAFE', color: '#1E40AF' }}>G</div>
                  <div className="preview-meta">
                    <div className="preview-name">you@gmail.com</div>
                    <div className="preview-sub">Gmail · Connected</div>
                  </div>
                  <span className="preview-badge preview-badge-ok">Active</span>
                </div>
                <div className="preview-row">
                  <div className="preview-avatar" style={{ background: '#FEF3C7', color: '#92400E' }}>H</div>
                  <div className="preview-meta">
                    <div className="preview-name">hello@yourbrand.com</div>
                    <div className="preview-sub">Hostinger · Connected</div>
                  </div>
                  <span className="preview-badge preview-badge-ok">Active</span>
                </div>
                <div className="preview-divider" />
                <div className="preview-stat-row">
                  <div><div className="preview-stat-label">Queued</div><div className="preview-stat-value">0</div></div>
                  <div><div className="preview-stat-label">Accepted</div><div className="preview-stat-value">248</div></div>
                  <div><div className="preview-stat-label">24h cap</div><div className="preview-stat-value">350</div></div>
                </div>
              </div>
            </div>
            <div className="preview-glow" />
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Features</span>
            <h2>Everything you need to run campaigns responsibly</h2>
            <p className="sub">Real features — no fake metrics, no dead buttons, no promised inbox placement.</p>
          </div>
          <div className="grid-3">
            {[
              ['Gmail OAuth 2.0', 'Connect Gmail with the minimum send scope. Refresh tokens encrypted at rest.', 'shield'],
              ['Hostinger Mail SMTP', 'Connect Hostinger or Titan Email with just your mailbox password.', 'mail'],
              ['Queue + scheduler', 'Database-backed job queue with atomic claiming, leases, and rolling 24h capacity.', 'layers'],
              ['CSV import', 'Contact import with mapping, validation, dedupe, tags, and suppression.', 'upload'],
              ['Unsubscribe + suppression', 'One-click List-Unsubscribe, tokenized landing, global suppression list.', 'bell'],
              ['Audit & analytics', 'Every send, connect, pause, export recorded. Accepted ≠ delivered, clearly labeled.', 'chart'],
            ].map(([title, desc, icon]) => (
              <div key={title} className="feature-card">
                <div className="feature-icon">{featureIcon(icon)}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section how-section" id="how">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">How it works</span>
            <h2>From zero to first send in 3 steps</h2>
            <p className="sub">No configuration files, no app passwords for Gmail, no SMTP wrangling.</p>
          </div>
          <div className="how-grid">
            {[
              ['1', 'Connect your sender', 'Click "Connect Gmail" or "Connect Hostinger Mail" above. Sign in once, done.'],
              ['2', 'Import your contacts', 'Upload a CSV with email, first_name, company. Duplicates are skipped automatically.'],
              ['3', 'Compose & send', 'Write your campaign, pick a sender, hit Send. The scheduler handles the rest.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="how-step">
                <div className="how-num">{n}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="security">
        <div className="container grid-2">
          <div>
            <span className="section-eyebrow">Security</span>
            <h2 style={{ fontSize: 34, margin: '10px 0 14px', letterSpacing: '-0.03em' }}>Built for security and transparency</h2>
            <p className="sub" style={{ textAlign: 'left', margin: '0 0 8px' }}>No secrets in the browser. No dark patterns. No quota evasion.</p>
            <ul className="check-list">
              {[
                'AES-256-GCM encryption for OAuth refresh tokens and mailbox passwords',
                'Row Level Security on every user-owned table',
                'Server-only service role; ownership validated on every route',
                'Software cap of 350 emails per sender per rolling 24h',
                'Global kill switch and per-sender pause',
                'Clear distinction between "accepted by provider" and "delivered"',
              ].map((t) => (
                <li key={t}>
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="#16A34A"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.707 6.293a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card security-note">
            <h3>What we do not claim</h3>
            <p>CertWinX is not affiliated with Google or Hostinger. We do not guarantee inbox placement, unlimited sending, or bypass of provider limits.</p>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">FAQ</span>
            <h2>Frequently asked questions</h2>
          </div>
          <div className="grid-2">
            {[
              ['Does CertWinX guarantee inbox placement?', 'No. Gmail / Hostinger acceptance is not proof of inbox delivery.'],
              ['Do you use a third-party mail relay?', 'No. Messages are sent by your own Gmail (API) or Hostinger (SMTP) account.'],
              ['How are sending limits enforced?', 'A software cap of 350 per sender per rolling 24h, reserved atomically before each send.'],
              ['Is this an official Google or Hostinger product?', 'No. CertWinX is an independent app built on public provider APIs.'],
              ['Can I try it without signing up?', 'Yes. Click "Connect Gmail" on the hero — a guest workspace is created automatically.'],
              ['What happens to my guest data?', 'It lives in your own Supabase. Add an email + password anytime to keep it permanently.'],
            ].map(([q, a]) => (
              <div key={q} className="faq-card">
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <div>
            <div className="landing-logo" style={{ marginBottom: 8 }}>
              <span className="landing-logo-mark">C</span>
              <span>CertWinX</span>
            </div>
            <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>
              Self-hosted email campaign automation. © {new Date().getFullYear()}
            </p>
          </div>
          <div className="landing-footer-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/aup">Acceptable use</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

function featureIcon(name: string) {
  const stroke = '#1C83F3';
  switch (name) {
    case 'shield': return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'mail': return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
    case 'layers': return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l10 6-10 6-10-6 10-6z"/><path d="M2 12l10 6 10-6"/><path d="M2 17l10 6 10-6"/></svg>;
    case 'upload': return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>;
    case 'bell': return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16l-2-3z"/><path d="M10 22a2 2 0 004 0"/></svg>;
    case 'chart': return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>;
    default: return null;
  }
}
EOF

# =============================================================
# 4. APPEND: Premium CSS (idempotent — marker check)
# =============================================================

CSS_MARK="/* ============ CertWinX Premium Landing v1 ============ */"

if ! grep -qF "$CSS_MARK" "src/app/globals.css" 2>/dev/null; then
  say "appending premium CSS to src/app/globals.css"
  cat >> "src/app/globals.css" <<'EOF'

/* ============ CertWinX Premium Landing v1 ============ */
:root {
  --blue: #1C83F3;
  --blue-600: #1D6FE0;
  --blue-700: #1657B8;
  --blue-deep: #0F2E6E;
  --blue-pale: #BFDBFE;
  --bg: #F6F8FB;
  --bg-soft: #FBFCFE;
  --white: #FFFFFF;
  --text: #0B1220;
  --text-soft: #334155;
  --muted: #64748B;
  --muted-2: #94A3B8;
  --line: #E5EAF1;
  --line-strong: #CBD5E1;
  --ok: #16A34A;
  --warn: #D97706;
  --err: #DC2626;
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --radius-xl: 22px;
  --shadow-xs: 0 1px 2px rgba(15,23,42,.04);
  --shadow-sm: 0 2px 6px rgba(15,23,42,.06);
  --shadow-md: 0 8px 24px -12px rgba(15,23,42,.15);
  --shadow-lg: 0 24px 48px -24px rgba(15,23,42,.25);
  --shadow-glow: 0 10px 30px -12px rgba(28,131,243,.55);
  --grad-primary: linear-gradient(135deg, #1C83F3 0%, #0F2E6E 100%);
  --grad-hero: radial-gradient(1200px 600px at 12% -10%, #E0EDFF 0%, transparent 55%),
               radial-gradient(900px 500px at 95% 110%, #DCEBFF 0%, transparent 55%),
               #FAFBFD;
  --ease: cubic-bezier(.4,0,.2,1);
}
body { font-size: 14.5px; line-height: 1.55; }
h1, h2, h3, h4 { letter-spacing: -0.02em; color: var(--text); }
::selection { background: #CFE4FF; color: var(--blue-deep); }

.btn { padding: 11px 18px; border-radius: 12px; font-weight: 600;
  transition: transform .15s var(--ease), box-shadow .18s var(--ease), background .18s var(--ease), border-color .15s var(--ease), color .15s var(--ease);
  box-shadow: var(--shadow-xs); }
.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.btn:active { transform: translateY(0) scale(.985); }
.btn-primary { background: var(--grad-primary); border-color: transparent; color: #fff; box-shadow: var(--shadow-glow); }
.btn-primary:hover { border-color: transparent; filter: brightness(1.05); box-shadow: 0 14px 34px -12px rgba(28,131,243,.7); }
.btn-sm { padding: 7px 12px; font-size: 13px; border-radius: 9px; }
.btn-lg { padding: 14px 22px; font-size: 15.5px; border-radius: 13px; }

.card { border-radius: 16px; box-shadow: var(--shadow-xs); transition: box-shadow .2s var(--ease), border-color .2s var(--ease), transform .2s var(--ease); }
.metric { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }

.input, .select, .textarea { padding: 11px 14px; border-radius: 12px;
  transition: border-color .15s var(--ease), box-shadow .15s var(--ease), background .15s var(--ease); }
.input:hover, .select:hover, .textarea:hover { border-color: var(--line-strong); }
.input:focus, .select:focus, .textarea:focus {
  outline: none; border-color: var(--blue);
  box-shadow: 0 0 0 4px rgba(28,131,243,.14), var(--shadow-xs); }
.textarea { font-size: 13.5px; line-height: 1.6; }

.table th, .table td { padding: 12px 14px; }
.table tr { transition: background .12s var(--ease); }
.table tr:hover td { background: #FAFCFF; }

.sidebar .brand { font-size: 19px; letter-spacing: -0.03em; display: flex; align-items: center; gap: 10px; }
.sidebar .brand::before {
  content: 'C'; width: 30px; height: 30px; border-radius: 9px;
  background: var(--grad-primary); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 800; box-shadow: var(--shadow-glow); }
.nav a { padding: 9px 12px; border-radius: 10px; font-size: 13.5px;
  transition: background .12s var(--ease), color .12s var(--ease), transform .12s var(--ease); }
.nav a:hover { transform: translateX(2px); }
.nav a.active { background: linear-gradient(135deg, #EAF3FF, #DCEBFF); color: var(--blue-deep); font-weight: 700; }

.section { padding: 84px 0; }
.section-head { text-align: center; margin-bottom: 46px; }
.section-eyebrow {
  display: inline-block; padding: 5px 12px; border-radius: 999px;
  background: #EAF3FF; color: var(--blue-deep);
  font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  margin-bottom: 14px; }
.section-head h2 { font-size: 36px; margin: 0 0 14px; letter-spacing: -0.03em; line-height: 1.15; }
.section-head .sub { color: var(--muted); max-width: 640px; margin: 0 auto; font-size: 16px; line-height: 1.65; }

/* Landing header */
.landing-header { position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,0.78);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  border-bottom: 1px solid rgba(229,234,241,.9); }
.landing-header-inner { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; gap: 22px; }
.landing-logo { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; color: var(--blue-deep); letter-spacing: -0.03em; }
.landing-logo:hover { text-decoration: none; }
.landing-logo-mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: var(--grad-primary); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 15px; box-shadow: var(--shadow-glow); }
.landing-nav { display: flex; gap: 28px; font-size: 14px; font-weight: 500; }
.landing-nav a { color: var(--text-soft); }
.landing-nav a:hover { color: var(--blue-deep); text-decoration: none; }
.landing-nav-cta { display: flex; gap: 8px; }
@media (max-width: 860px) { .landing-nav { display: none; } }

/* Hero */
.landing-hero { position: relative; overflow: hidden; padding: 96px 0 84px; background: var(--grad-hero); }
.landing-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(28,131,243,.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(28,131,243,.07) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 80%);
          mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 80%); }
.landing-hero-grid { position: relative; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 64px; align-items: center; }
@media (max-width: 1000px) { .landing-hero-grid { grid-template-columns: 1fr; gap: 44px; } }
.landing-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 14px; background: #fff; border: 1px solid var(--line);
  border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--text-soft);
  box-shadow: var(--shadow-xs); }
.landing-eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); animation: pulse-dot 2.2s infinite; }
@keyframes pulse-dot {
  0%,100% { box-shadow: 0 0 0 4px rgba(22,163,74,.16); }
  50% { box-shadow: 0 0 0 9px rgba(22,163,74,.05); } }
.landing-hero h1 { font-size: 62px; line-height: 1.03; letter-spacing: -0.035em; font-weight: 800; margin: 22px 0 20px; color: #060B18; }
@media (max-width: 1000px) { .landing-hero h1 { font-size: 44px; } }
@media (max-width: 520px) { .landing-hero h1 { font-size: 34px; } }
.gradient-text {
  background: linear-gradient(120deg, #1C83F3 0%, #0F2E6E 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; }
.landing-lead { font-size: 17.5px; line-height: 1.65; color: var(--text-soft); max-width: 580px; margin: 0 0 30px; }
.landing-lead strong { color: var(--text); font-weight: 700; }
.landing-trust { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 26px; font-size: 13px; color: var(--muted); }
.landing-trust-item { display: inline-flex; align-items: center; gap: 7px; }

/* Landing connect widget */
.lc-wrap { margin-top: 6px; }
.lc-cta-row { display: flex; flex-wrap: wrap; gap: 12px; }
.lc-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 22px; border-radius: 13px; font-size: 15px; font-weight: 600;
  cursor: pointer; border: 1px solid transparent;
  transition: transform .15s var(--ease), box-shadow .2s var(--ease), background .2s var(--ease), border-color .15s var(--ease); }
.lc-btn:disabled { opacity: .6; cursor: not-allowed; }
.lc-btn-primary { background: var(--grad-primary); color: #fff; box-shadow: var(--shadow-glow); }
.lc-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px -12px rgba(28,131,243,.75); }
.lc-btn-secondary { background: #fff; border-color: var(--line); color: var(--text); box-shadow: var(--shadow-sm); }
.lc-btn-secondary:hover:not(:disabled) { border-color: var(--line-strong); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.lc-note { font-size: 12.5px; color: var(--muted); margin: 14px 0 0; }
.lc-form {
  margin-top: 22px; padding: 22px; border-radius: 16px;
  background: #fff; border: 1px solid var(--line); box-shadow: var(--shadow-md);
  animation: lc-form-in .22s var(--ease); }
@keyframes lc-form-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
.lc-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .lc-form-grid { grid-template-columns: 1fr; } }
.lc-msg { margin-top: 16px; padding: 12px 15px; border-radius: 11px; font-size: 13.5px; line-height: 1.55; }
.lc-msg-ok { background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; }
.lc-msg-error { background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; }

/* Preview card */
.landing-hero-visual { position: relative; display: flex; justify-content: center; }
.preview-card {
  position: relative; width: 100%; max-width: 440px;
  background: #fff; border: 1px solid var(--line); border-radius: 18px;
  box-shadow: 0 40px 80px -40px rgba(15,23,42,.35), 0 12px 30px -14px rgba(28,131,243,.25);
  transform: perspective(1400px) rotateY(-7deg) rotateX(3deg);
  transition: transform .5s var(--ease); }
.preview-card:hover { transform: perspective(1400px) rotateY(-3deg) rotateX(1deg); }
.preview-card-header {
  display: flex; align-items: center; gap: 6px; padding: 13px 15px;
  border-bottom: 1px solid var(--line); background: #F8FAFC; border-radius: 18px 18px 0 0; }
.preview-dot { width: 11px; height: 11px; border-radius: 50%; }
.preview-title { margin-left: 12px; font-size: 12px; color: var(--muted-2); font-family: ui-monospace, Menlo, monospace; }
.preview-card-body { padding: 20px; }
.preview-row {
  display: flex; align-items: center; gap: 12px;
  padding: 13px; border-radius: 12px; border: 1px solid var(--line); margin-bottom: 10px;
  transition: border-color .15s var(--ease), background .15s var(--ease); }
.preview-row:hover { border-color: var(--blue-pale); background: #FAFCFF; }
.preview-avatar { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
.preview-meta { flex: 1; min-width: 0; }
.preview-name { font-weight: 600; font-size: 13.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
.preview-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.preview-badge-ok { background: #DCFCE7; color: #166534; }
.preview-divider { height: 1px; background: var(--line); margin: 10px 0 16px; }
.preview-stat-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.preview-stat-label { font-size: 11px; color: var(--muted-2); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
.preview-stat-value { font-size: 19px; font-weight: 800; color: var(--text); margin-top: 3px; letter-spacing: -0.02em; }
.preview-glow { position: absolute; inset: -24px; z-index: -1; background: radial-gradient(closest-side, rgba(28,131,243,.4), transparent 72%); filter: blur(34px); }

/* Features */
.feature-card {
  background: #fff; border: 1px solid var(--line); border-radius: 16px;
  padding: 26px; transition: transform .2s var(--ease), box-shadow .25s var(--ease), border-color .2s var(--ease); }
.feature-card:hover { transform: translateY(-4px); border-color: var(--blue-pale); box-shadow: 0 24px 48px -24px rgba(28,131,243,.35); }
.feature-icon { width: 46px; height: 46px; border-radius: 12px;
  background: linear-gradient(135deg, #EAF3FF 0%, #DCEBFF 100%);
  display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.feature-card h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: -0.02em; }
.feature-card p { margin: 0; color: var(--text-soft); font-size: 14px; line-height: 1.65; }

/* How it works */
.how-section { background: #fff; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; }
@media (max-width: 860px) { .how-grid { grid-template-columns: 1fr; } }
.how-step { position: relative; padding-left: 66px; }
.how-num {
  position: absolute; left: 0; top: 0; width: 48px; height: 48px; border-radius: 14px;
  background: var(--grad-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 21px; box-shadow: var(--shadow-glow); }
.how-step h3 { margin: 8px 0 8px; font-size: 17px; letter-spacing: -0.02em; }
.how-step p { margin: 0; color: var(--text-soft); font-size: 14px; line-height: 1.65; }

/* Security list */
.check-list { list-style: none; padding: 0; margin: 26px 0 0; }
.check-list li { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 13px; font-size: 14.5px; color: var(--text-soft); line-height: 1.55; }
.check-list svg { flex-shrink: 0; margin-top: 2px; }
.security-note { align-self: start; }
.security-note h3 { margin: 0 0 10px; font-size: 17px; }
.security-note p { margin: 0; color: var(--text-soft); font-size: 14px; line-height: 1.65; }

/* FAQ */
.faq-card {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 22px; transition: border-color .15s var(--ease), box-shadow .15s var(--ease); }
.faq-card:hover { border-color: var(--blue-pale); box-shadow: var(--shadow-sm); }
.faq-card h3 { margin: 0 0 8px; font-size: 15px; letter-spacing: -0.01em; }
.faq-card p { margin: 0; color: var(--text-soft); font-size: 14px; line-height: 1.65; }

/* Footer */
.landing-footer { padding: 44px 0; border-top: 1px solid var(--line); background: #fff; }
.landing-footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 18px; }
.landing-footer-links { display: flex; gap: 24px; font-size: 13.5px; }
.landing-footer-links a { color: var(--text-soft); }

/* Welcome page */
.welcome-shell {
  min-height: 100vh; display: grid; place-items: center;
  background: radial-gradient(800px 500px at 50% -10%, #E0EDFF 0%, transparent 60%), var(--bg);
  padding: 40px 20px; }
.welcome-card {
  width: 100%; max-width: 580px; background: #fff;
  border: 1px solid var(--line); border-radius: 22px; padding: 44px;
  box-shadow: 0 40px 80px -40px rgba(15,23,42,.3);
  text-align: center; }
.welcome-icon { display: flex; justify-content: center; margin-bottom: 22px; }
.welcome-card h1 { font-size: 27px; margin: 0 0 10px; letter-spacing: -0.03em; }
.welcome-sub { color: var(--text-soft); margin: 0 0 26px; font-size: 15px; line-height: 1.65; }
.welcome-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.welcome-save {
  margin-top: 34px; padding: 26px; text-align: left;
  background: var(--bg-soft); border: 1px dashed var(--line-strong); border-radius: 16px; }
.welcome-save-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.welcome-save-sub { color: var(--text-soft); font-size: 13.5px; line-height: 1.6; margin: 0 0 18px; }
.welcome-save-form { display: flex; flex-direction: column; gap: 10px; }
.welcome-save-form .input { background: #fff; }

/* Auth pages */
.auth-shell {
  min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: var(--grad-hero); }
.auth-card {
  width: 100%; max-width: 440px; background: #fff;
  border: 1px solid var(--line); border-radius: 22px; padding: 40px;
  box-shadow: 0 40px 80px -40px rgba(15,23,42,.3); }
.auth-logo { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; color: var(--blue-deep); letter-spacing: -0.03em; margin-bottom: 6px; }
.auth-logo-mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: var(--grad-primary); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 15px; box-shadow: var(--shadow-glow); }
.auth-card h1 { font-size: 22px; margin: 8px 0 22px; letter-spacing: -0.02em; }
.auth-footer { margin-top: 18px; font-size: 13px; text-align: center; color: var(--muted); }
.auth-footer a { font-weight: 600; }

/* Fade animations */
@keyframes fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.fade-up { animation: fade-up .5s var(--ease) both; }
.fade-up-delay-1 { animation-delay: .08s; }
.fade-up-delay-2 { animation-delay: .16s; }
.fade-up-delay-3 { animation-delay: .24s; }
EOF
else
  say "premium CSS already applied — skipping"
fi

# =============================================================
# 5. PATCH: OAuth callback → redirect to /welcome
# =============================================================

CALLBACK="src/app/api/oauth/google/callback/route.ts"
if [ -f "$CALLBACK" ] && grep -q "new URL('/senders', req.url)" "$CALLBACK"; then
  backup "$CALLBACK"
  # macOS-safe sed
  if sed --version >/dev/null 2>&1; then
    sed -i "s|new URL('/senders', req.url)|new URL('/welcome', req.url)|g" "$CALLBACK"
  else
    sed -i '' "s|new URL('/senders', req.url)|new URL('/welcome', req.url)|g" "$CALLBACK"
  fi
  say "patched oauth callback → /welcome"
else
  say "oauth callback already patched or missing — skipping"
fi

# =============================================================
# DONE
# =============================================================

say ""
say "✅ Premium upgrade applied to: $ROOT"
say ""
say "Files added/changed:"
say "  + src/components/LandingConnect.tsx     (new)"
say "  + src/app/welcome/page.tsx              (new)"
say "  ~ src/app/page.tsx                      (premium landing)"
say "  ~ src/app/globals.css                   (premium styles appended)"
say "  ~ src/app/api/oauth/google/callback     (redirect → /welcome)"
say ""
say "Backups saved as *.bak.<timestamp> (restore if needed)."
say ""
say "⚠️  ONE MANUAL STEP (required):"
say "   Supabase → Authentication → Sign In / Providers"
say "   → Enable 'Anonymous Sign-ins'  (guest connect needs this)"
say ""
say "Then: npm run dev   → open http://localhost:3000"