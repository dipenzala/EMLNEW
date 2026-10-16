import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      <header style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#163A8A' }}>CertWinX</div>
          <nav style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 14 }}>
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
            <Link className="btn btn-primary btn-sm" href="/login">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <span className="eyebrow">Gmail + Hostinger campaigns, no third-party senders</span>
          <h1>Email campaigns that run from your own mailbox.</h1>
          <p className="lead">CertWinX is a self-hosted email campaign manager for teams that send from their own <strong>Gmail</strong> or <strong>Hostinger Mail</strong> account, keep their data in Supabase, and deploy on Vercel — with transparent quotas, suppression, and auditability.</p>
          <div className="cta">
            <Link className="btn btn-primary" href="/signup">Get started</Link>
            <Link className="btn" href="/contact">Talk to us</Link>
          </div>
          <p style={{ marginTop: 16, color: '#64748B', fontSize: 13 }}>You provide your own Google Cloud / Hostinger / Supabase / Vercel credentials. No app passwords for Gmail, no Google partnership claims.</p>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <h2>Everything you need to run campaigns responsibly</h2>
          <p className="sub">Real features — no fake metrics, no dead buttons, no promised inbox placement.</p>
          <div className="grid-3">
            {[
              ['Gmail OAuth 2.0 sender', 'Connect a Gmail account with the minimum send scope. Refresh tokens encrypted at rest.'],
              ['Hostinger Mail (SMTP)', 'Connect Hostinger Mail or bundled Titan Email with your email password. Regional hosts supported.'],
              ['Queue + scheduler', 'Database-backed job queue with atomic claiming, leases, and rolling 24h capacity.'],
              ['Contact import', 'CSV import with mapping, preview, validation, dedupe, tags, and suppression.'],
              ['Suppression & unsubscribe', 'One-click List-Unsubscribe, tokenized unsubscribe landing, global suppression list.'],
              ['Audit & analytics', 'Every send, connect, pause, export recorded. Accepted vs. delivered clearly separated.'],
            ].map(([t, d]) => (
              <div key={t} className="card">
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{t}</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="security">
        <div className="container grid-2">
          <div>
            <h2>Built for security and transparency</h2>
            <p className="sub">No secrets in the browser. No dark patterns. No quota evasion.</p>
            <ul style={{ color: '#334155', lineHeight: 1.9 }}>
              <li>AES-256-GCM encryption of OAuth refresh tokens and Hostinger SMTP passwords.</li>
              <li>Row Level Security on every user-owned table.</li>
              <li>Server-only service role; validated ownership on every route.</li>
              <li>Software cap of 350 emails / sender / rolling 24h.</li>
              <li>Global kill switch and per-sender pause.</li>
              <li>Clear distinction between API-accepted and delivered.</li>
            </ul>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>What we do not claim</h3>
            <p style={{ color: '#475569', margin: 0 }}>CertWinX is not affiliated with Google or Hostinger. We do not guarantee inbox placement, unlimited sending, or bypass of provider limits.</p>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <h2>FAQ</h2>
          <div className="grid-2" style={{ marginTop: 24 }}>
            {[
              ['Does CertWinX guarantee inbox placement?', 'No. Gmail / Hostinger acceptance is not proof of inbox delivery.'],
              ['Do you use a third-party mail relay?', 'No. Messages are sent by your own Gmail (API) or Hostinger (SMTP) account.'],
              ['How are sending limits enforced?', 'A software cap of 350 per sender per rolling 24h, reserved atomically before each send.'],
              ['Is there an official Google or Hostinger partnership?', 'No. CertWinX is an independent application using public provider APIs.'],
            ].map(([q, a]) => (
              <div key={q} className="card">
                <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{q}</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="site">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>© {new Date().getFullYear()} CertWinX. Operator-editable legal text.</div>
          <div style={{ display: 'flex', gap: 18 }}>
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
