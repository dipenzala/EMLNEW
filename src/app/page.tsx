'use client';
import Link from 'next/link';
import LandingConnect from '@/components/LandingConnect';
import { motion } from 'framer-motion';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', overflowX: 'hidden', position: 'relative', fontFamily: 'sans-serif' }}>
      
      <style>{`
        .responsive-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250, 250, 250, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #E2E8F0;
          padding: 16px 20px;
          display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
        }
        .responsive-hero {
          display: flex; flex-direction: column; gap: 40px;
          padding: 40px 20px; max-width: 1200px; margin: 0 auto; position: relative; z-index: 10;
        }
        @media (min-width: 900px) {
          .responsive-hero { flex-direction: row; align-items: center; padding: 80px 20px; gap: 60px; }
          .hero-left { flex: 1; }
          .hero-right { flex: 1; }
        }
        .feature-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;
          max-width: 1200px; margin: 0 auto;
        }
        
        /* Cloud Animations */
        .cloud-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: 0; pointer-events: none; }
        .cloud { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6; animation: float 20s infinite ease-in-out alternate; }
        .cloud-1 { width: 300px; height: 300px; background: #DBEAFE; top: -50px; left: -50px; }
        .cloud-2 { width: 250px; height: 250px; background: #E0E7FF; top: 30%; right: -50px; animation-duration: 25s; }
        .cloud-3 { width: 400px; height: 400px; background: #F3E8FF; bottom: 0%; left: 10%; animation-duration: 30s; opacity: 0.4; }
        
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, 30px) scale(1.05); }
          100% { transform: translate(-10px, -20px) scale(0.95); }
        }
      `}</style>

      {/* Clouds Background */}
      <div className="cloud-container">
        <div className="cloud cloud-1"></div>
        <div className="cloud cloud-2"></div>
        <div className="cloud cloud-3"></div>
      </div>

      {/* Navbar */}
      <nav className="responsive-nav">
        <Link href="/" style={{ fontSize: 20, fontWeight: 800, color: '#1E3A8A', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: '#1C83F3', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>
          CertWinX
        </Link>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
          <Link href="/login" style={{ color: '#475569', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/signup" style={{ background: '#1C83F3', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="responsive-hero">
        <motion.div className="hero-left" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 99, fontSize: 13, fontWeight: 700, marginBottom: 20, border: '1px solid #BFDBFE' }}>
            ✨ No login required to start
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 7vw, 60px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.03em', wordWrap: 'break-word' }}>
            Send email campaigns from <span style={{ color: '#1C83F3' }}>your own mailbox</span>.
          </h1>
          <p style={{ fontSize: 18, color: '#475569', lineHeight: 1.6, marginBottom: 32, maxWidth: 540 }}>
            CertWinX is a high-end email campaign manager for teams that send from their own Gmail or Hostinger Mail. No third-party relay, zero fake promises.
          </p>
          <LandingConnect />
        </motion.div>

        <motion.div className="hero-right" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', overflow: 'hidden', width: '100%', maxWidth: 500, margin: '0 auto' }}>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: '1px solid #E2E8F0', borderRadius: 12 }}>
                <div style={{ width: 40, height: 40, background: '#dbeafe', color: '#1e40af', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>G</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>admin@gmail.com</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Connected · Sender</div>
                </div>
                <div style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Active</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section style={{ background: '#fff', padding: '60px 20px', borderTop: '1px solid #E2E8F0', position: 'relative', zIndex: 10 }}>
        <div className="feature-grid">
          {[
            { t: 'OAuth 2.0', d: 'Connect Gmail securely with token encryption.' },
            { t: 'Hostinger SMTP', d: 'Just add your mailbox password and start sending.' },
            { t: 'Smart Scheduler', d: 'Set it and forget it. Auto-sends at your chosen time.' },
          ].map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{ padding: 30, background: '#FAFAFA', borderRadius: 16, border: '1px solid #E2E8F0' }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>{f.t}</h3>
              <p style={{ color: '#64748B', lineHeight: 1.6, margin: 0 }}>{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer style={{ padding: '40px', textAlign: 'center', color: '#64748b', borderTop: '1px solid #E2E8F0', background: '#fff' }}>
        © {new Date().getFullYear()} CertWinX. All rights reserved.
      </footer>
    </div>
  );
}