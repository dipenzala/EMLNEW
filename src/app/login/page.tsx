'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setOk(false);
    const sb = createSupabaseBrowser();
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.session) throw new Error('No session returned. Check Supabase "Confirm email" settings.');
      setOk(true);
      setMsg('Signed in. Redirecting…');
      setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 300);
    } catch (err) {
      const e = err as { message?: string };
      setMsg(e?.message || 'Sign in failed');
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F2F3F4', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#163A8A', marginBottom: 4 }}>CertWinX</div>
        <h1 style={{ fontSize: 20, margin: '4px 0 20px' }}>Sign in</h1>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={busy} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password}
            onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={busy} />
        </div>

        <button className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Please wait…' : 'Sign in'}
        </button>

        <div style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>
          <Link href="/signup" style={{ color: '#1C83F3', fontWeight: 600 }}>
            Need an account? Sign up
          </Link>
        </div>
        {msg && (
          <div style={{ marginTop: 14, padding: 10, borderRadius: 8, fontSize: 13, background: ok ? '#DCFCE7' : '#FEE2E2', color: ok ? '#166534' : '#991B1B', lineHeight: 1.5 }}>{msg}</div>
        )}
      </form>
    </div>
  );
}
