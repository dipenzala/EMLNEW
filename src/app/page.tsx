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
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
