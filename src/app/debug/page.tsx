'use client';
import { useEffect, useState } from 'react';

export default function DebugPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!mounted) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#F2F3F4', padding: 40 }}>
      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>CertWinX diagnostics</h1>

        <div style={{ marginTop: 20, padding: 16, background: url ? '#DCFCE7' : '#FEE2E2', borderRadius: 8 }}>
          <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>{' '}
          {url ? `✅ present (${url.slice(0, 40)}…)` : '❌ MISSING'}
        </div>

        <div style={{ marginTop: 12, padding: 16, background: key ? '#DCFCE7' : '#FEE2E2', borderRadius: 8 }}>
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>{' '}
          {key ? `✅ present (${key.length} chars)` : '❌ MISSING'}
        </div>

        <div style={{ marginTop: 24, padding: 16, background: '#F8FAFC', borderRadius: 8, fontSize: 13 }}>
          <strong>What to do:</strong>
          <ol style={{ marginTop: 8, lineHeight: 1.8 }}>
            <li>If either ❌ — open <code>certwinx/.env.local</code> and add Supabase keys.</li>
            <li>Save file (<code>Ctrl + S</code>).</li>
            <li>Stop dev server (<code>Ctrl + C</code>) and run <code>npm run dev</code>.</li>
            <li>Refresh this page.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
