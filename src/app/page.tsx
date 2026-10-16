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
