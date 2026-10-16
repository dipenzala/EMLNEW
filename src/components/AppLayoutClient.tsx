'use client';
import { ToastProvider } from './Toast';
import Sidebar from './Sidebar';

export default function AppLayoutClient({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <div className="topbar">
            <div />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {email && <span style={{ color: '#64748B', fontSize: 13 }}>{email}</span>}
              <form action="/api/auth/signout" method="post">
                <button className="btn btn-sm" type="submit">Sign out</button>
              </form>
            </div>
          </div>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
