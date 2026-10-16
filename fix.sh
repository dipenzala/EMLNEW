#!/usr/bin/env bash
# CertWinX Fix: mobile layout + force sign-in after guest connect
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."
[ -d "src/app" ] || die "src/app not found."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. PATCH: (app)/layout.tsx — force anonymous users to /welcome
# =============================================================

backup "src/app/(app)/layout.tsx"

write "src/app/(app)/layout.tsx" <<'EOF'
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import AppLayoutClient from '@/components/AppLayoutClient';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Anonymous (guest) users must save their workspace before entering the app.
  if ((user as any).is_anonymous) {
    redirect('/welcome?force=1');
  }
  return <AppLayoutClient email={user.email}>{children}</AppLayoutClient>;
}
EOF

# =============================================================
# 2. REPLACE: welcome page — enforce + redirect after save
# =============================================================

backup "src/app/welcome/page.tsx"

write "src/app/welcome/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function WelcomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const force = params?.get('force') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      const anon = !!(data.user as any)?.is_anonymous;
      setAnonymous(anon);
      // If already a real account, nothing to do — go straight to app.
      if (!anon && data.user) {
        router.replace('/dashboard');
      }
    });
  }, [router]);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true); setMsg(null);
    try {
      const sb = createSupabaseBrowser();
      const { error } = await sb.auth.updateUser({ email, password });
      if (error) throw error;

      // If Supabase has "Confirm email" OFF, the session upgrades immediately.
      const { data: { session } } = await sb.auth.getSession();
      if (session && !(session.user as any).is_anonymous) {
        setMsg({ kind: 'ok', text: 'Account saved ✅ Taking you to the dashboard…' });
        setTimeout(() => router.replace('/dashboard'), 600);
      } else {
        setMsg({
          kind: 'ok',
          text: 'Account saved ✅ Check your inbox to confirm, then sign in normally. Meanwhile your workspace is still a guest.',
        });
        setBusy(false);
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
      setBusy(false);
    }
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

        {force && anonymous ? (
          <p className="welcome-sub" style={{ color: '#92400E' }}>
            ⚠️ To open the dashboard and keep your sender, you must first <strong>save your workspace</strong> below.
            Without it, everything is temporary.
          </p>
        ) : (
          <p className="welcome-sub">
            Your email account is now available in CertWinX. Head to the dashboard to send your first campaign.
          </p>
        )}

        <div className="welcome-actions">
          {!anonymous && (
            <>
              <Link className="btn btn-primary" href="/senders">Go to Senders</Link>
              <Link className="btn" href="/dashboard">Open Dashboard</Link>
            </>
          )}
        </div>

        {anonymous && (
          <div className="welcome-save">
            <div className="welcome-save-head">
              <strong>Save your workspace</strong>
              <span className="badge badge-warn">Required</span>
            </div>
            <p className="welcome-save-sub">
              Add an email and password to keep your sender, campaigns, and data. You&apos;ll then be able to sign in from anywhere.
            </p>
            <form onSubmit={saveAccount} className="welcome-save-form">
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
              <input className="input" type="password" placeholder="Password (min 8 chars)" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy} required />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & continue'}</button>
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
# 3. PATCH: Sidebar — mobile-friendly horizontal nav
# =============================================================

backup "src/components/Sidebar.tsx"

write "src/components/Sidebar.tsx" <<'EOF'
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items: Array<[string, string]> = [
  ['Overview', '/dashboard'],
  ['Quick Send', '/quick-send'],
  ['Senders', '/senders'],
  ['Contacts', '/contacts'],
  ['Campaigns', '/campaigns'],
  ['Templates', '/templates'],
  ['Analytics', '/analytics'],
  ['Suppression', '/suppression'],
  ['Activity', '/activity'],
  ['Settings', '/settings'],
  ['Help', '/help'],
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">CertWinX</div>
      <nav className="nav">
        {items.map(([label, href]) => (
          <Link key={href} href={href} className={path?.startsWith(href) ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
    </aside>
  );
}
EOF

# =============================================================
# 4. APPEND: mobile-fix CSS (idempotent)
# =============================================================

MARK="/* CertWinX mobile-fix v1 */"
if ! grep -qF "$MARK" "src/app/globals.css" 2>/dev/null; then
  cat >> "src/app/globals.css" <<'EOF'

/* CertWinX mobile-fix v1 */
@media (max-width: 900px) {
  /* Sidebar → horizontal top nav */
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .sidebar {
    position: sticky; top: 0; z-index: 40;
    height: auto; width: 100%;
    padding: 10px 14px;
    border-right: none;
    border-bottom: 1px solid var(--line);
    background: rgba(255,255,255,0.92);
    backdrop-filter: saturate(180%) blur(12px);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    display: flex; align-items: center; gap: 14px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .sidebar .brand {
    padding: 0; margin: 0; font-size: 16px;
    flex-shrink: 0;
  }
  .sidebar .brand::before { width: 26px; height: 26px; font-size: 13px; }
  .nav {
    display: flex; gap: 4px; flex-shrink: 0;
    padding: 0; margin: 0;
  }
  .nav a {
    white-space: nowrap;
    padding: 6px 11px; margin: 0; font-size: 13px;
    border-radius: 999px;
  }
  .nav a.active { background: var(--blue); color: #fff; }
  .nav a.active:hover { transform: none; }

  /* Main padding tighter */
  .main { padding: 14px 14px 40px; }

  /* Topbar compact — hide email, keep sign-out */
  .topbar { margin-bottom: 16px; gap: 8px; }
  .topbar h1 { font-size: 19px; }
  .topbar > div:last-child > span { display: none; } /* hide email on mobile */

  /* Grids stack tighter */
  .grid-2 { grid-template-columns: 1fr; gap: 14px; }
  .grid-3 { grid-template-columns: 1fr; gap: 14px; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); gap: 12px; }

  /* Cards / metrics smaller */
  .card { padding: 16px; border-radius: 14px; }
  .metric { font-size: 22px; }
  .card-title { font-size: 11px; }

  /* Tables scroll horizontally, don't shrink */
  .card:has(.table) { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table { min-width: 640px; font-size: 13px; }
  .table th, .table td { padding: 9px 10px; }

  /* Buttons touch-friendly */
  .btn { padding: 9px 14px; font-size: 13.5px; }
  .btn-sm { padding: 7px 10px; font-size: 12.5px; }

  /* Form fields full width */
  .field label { font-size: 12.5px; }
  .input, .select, .textarea { font-size: 16px; } /* prevents iOS zoom */

  /* Landing page mobile */
  .landing-header-inner { padding: 12px 16px; }
  .landing-nav { display: none; }
  .landing-hero { padding: 56px 0 44px; }
  .landing-hero h1 { font-size: 34px; }
  .landing-lead { font-size: 15.5px; }
  .section { padding: 56px 0; }
  .section-head h2 { font-size: 26px; }
  .lc-cta-row { flex-direction: column; }
  .lc-btn { width: 100%; justify-content: center; }
  .lc-form-grid { grid-template-columns: 1fr; }
  .preview-card { transform: none; }
  .preview-card:hover { transform: none; }
  .how-grid { grid-template-columns: 1fr; gap: 24px; }
  .how-step { padding-left: 58px; }
  .welcome-card { padding: 28px 22px; }
  .welcome-card h1 { font-size: 22px; }
  .auth-card { padding: 28px 22px; }
}

/* Small phones */
@media (max-width: 480px) {
  .grid-4 { grid-template-columns: 1fr; }
  .nav a { font-size: 12.5px; padding: 6px 10px; }
}
EOF
  say "appended mobile-fix CSS"
else
  say "mobile-fix CSS already applied"
fi

# =============================================================
# DONE
# =============================================================

say ""
say "✅ Fix applied."
say ""
say "What changed:"
say "  ~ src/app/(app)/layout.tsx     → anonymous users redirect to /welcome?force=1"
say "  ~ src/app/welcome/page.tsx     → required save + auto-redirect to dashboard"
say "  ~ src/components/Sidebar.tsx   → unchanged logic (used by new CSS)"
say "  ~ src/app/globals.css          → mobile layout fixed"
say ""
say "Restart dev server:  npm run dev"
say "Then push to Vercel."
EOF