#!/usr/bin/env bash
set -euo pipefail
[ -f "package.json" ] || { echo "Run from project root."; exit 1; }

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# 1. Install Framer Motion for premium animations
say "Installing Framer Motion..."
npm install framer-motion --silent

# 2. Upgrade Landing Page with Scroll Animations
say "Upgrading Landing Page with premium scroll animations..."
backup "src/app/page.tsx"
cat > "src/app/page.tsx" <<'EOF'
'use client';
import Link from 'next/link';
import LandingConnect from '@/components/LandingConnect';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

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
          </nav>
          <div className="landing-nav-cta">
            <Link className="btn btn-sm" href="/login">Sign in</Link>
            <Link className="btn btn-primary btn-sm" href="/signup">Sign up free</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="container landing-hero-grid">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="landing-hero-copy">
            <motion.span variants={fadeUp} className="landing-eyebrow">
              <span className="landing-eyebrow-dot" />
              Connect in 60 seconds · No login required
            </motion.span>
            <motion.h1 variants={fadeUp}>
              Send email campaigns from <span className="gradient-text">your own mailbox</span>.
            </motion.h1>
            <motion.p variants={fadeUp} className="landing-lead">
              CertWinX is a self-hosted email campaign manager for teams that send from their
              own <strong>Gmail</strong> or <strong>Hostinger Mail</strong> account. No third-party
              relay, no spoofed senders, no fake deliverability promises.
            </motion.p>
            <motion.div variants={fadeUp}>
              <LandingConnect />
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ duration: 0.8, delay: 0.2 }}
            className="landing-hero-visual"
          >
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
              </div>
            </div>
            <div className="preview-glow" />
          </motion.div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="section-head">
            <span className="section-eyebrow">Features</span>
            <h2>Everything you need to run campaigns responsibly</h2>
            <p className="sub">Real features — no fake metrics, no dead buttons, no promised inbox placement.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid-3">
            {[
              ['Gmail OAuth 2.0', 'Connect Gmail with the minimum send scope. Refresh tokens encrypted at rest.', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
              ['Hostinger Mail SMTP', 'Connect Hostinger or Titan Email with just your mailbox password.', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12'],
              ['Queue + scheduler', 'Database-backed job queue with atomic claiming, leases, and rolling 24h capacity.', 'M12 2l10 6-10 6-10-6 10-6z'],
              ['CSV import', 'Contact import with mapping, validation, dedupe, tags, and suppression.', 'M3 3v18h18M7 15l4-4 3 3 5-6'],
              ['Unsubscribe + suppression', 'One-click List-Unsubscribe, tokenized landing, global suppression list.', 'M18 16v-5a6 6 0 10-12 0v5l-2 3h16l-2-3z'],
              ['Audit & analytics', 'Every send, connect, pause, export recorded. Accepted != delivered, clearly labeled.', 'M10 2a8 8 0 100 16 8 8 0 000-16z'],
            ].map(([title, desc, d], i) => (
              <motion.div key={title} variants={fadeUp} className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1C83F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </motion.div>
            ))}
          </motion.div>
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
EOF

# 3. Upgrade Dashboard with Live History (Re-apply just to be sure)
say "Applying Live Dashboard History..."
backup "src/app/(app)/dashboard/page.tsx"
cat > "src/app/(app)/dashboard/page.tsx" <<'EOF'
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

# 4. Add Framer Motion package to dependencies just in case
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['framer-motion'] = '^11.0.0';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

say ""
say "✅ Premium Landing Page + Dashboard History applied."
say ""
say "Now run:"
say "  npm run build"
say "  git add . && git commit -m 'feat: framer motion landing + live dashboard history' && git push"