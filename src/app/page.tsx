'use client';
import Link from 'next/link';
import LandingConnect from '@/components/LandingConnect';
import { motion } from 'framer-motion';

export default function LandingPage() {
  // Safe inline styles for this page only
  const styles = {
    container: { minHeight: '100vh', background: '#ffffff', color: '#0f172a', fontFamily: 'sans-serif', overflowX: 'hidden' as const },
    nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid #e2e8f0', position: 'sticky' as const, top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', zIndex: 50 },
    logo: { fontSize: 24, fontWeight: 800, color: '#0f2e6e', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
    logoIcon: { width: 36, height: 36, background: '#1c83f3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, fontSize: 20 },
    hero: { display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 60, padding: '80px 40px', maxWidth: 1200, margin: '0 auto', alignItems: 'center' },
    h1: { fontSize: 64, fontWeight: 800, lineHeight: 1.05, marginBottom: 24, letterSpacing: '-0.03em' },
    lead: { fontSize: 20, color: '#475569', lineHeight: 1.6, marginBottom: 32, maxWidth: 540 },
    featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, padding: '60px 40px', maxWidth: 1200, margin: '0 auto' },
    card: { padding: 30, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div style={styles.container}>
      {/* NAVBAR */}
      <nav style={styles.nav}>
        <Link href="/" style={styles.logo}>
          <span style={styles.logoIcon}>C</span> CertWinX
        </Link>
        <div style={{ display: 'flex', gap: 30, alignItems: 'center', fontWeight: 600 }}>
          <a href="#features" style={{ color: '#475569', textDecoration: 'none' }}>Features</a>
          <Link href="/login" style={{ color: '#0f172a', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/signup" style={{ background: '#1c83f3', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none' }}>Get Started</Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={styles.hero}>
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
          <motion.div variants={fadeUp} style={{ display: 'inline-block', padding: '8px 16px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 20, fontSize: 14, fontWeight: 700, marginBottom: 24 }}>
            ✨ No login required to start
          </motion.div>
          <motion.h1 variants={fadeUp} style={styles.h1}>
            Send email campaigns from <span style={{ color: '#1c83f3' }}>your own mailbox</span>.
          </motion.h1>
          <motion.p variants={fadeUp} style={styles.lead}>
            CertWinX is a high-end email campaign manager for teams that send from their own Gmail or Hostinger Mail. No third-party relay, zero fake promises.
          </motion.p>
          <motion.div variants={fadeUp}>
            <LandingConnect />
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ position: 'relative' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ padding: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ width: 44, height: 44, background: '#dbeafe', color: '#1e40af', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>G</div>
                <div>
                  <div style={{ fontWeight: 700 }}>admin@gmail.com</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Connected · Sender</div>
                </div>
                <div style={{ marginLeft: 'auto', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Active</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: '#f8fafc', padding: '80px 0', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center', padding: '0 40px' }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16 }}>Everything you need</h2>
          <p style={{ fontSize: 18, color: '#64748b', marginBottom: 60 }}>No fake metrics, no dead buttons.</p>
        </div>
        <div style={styles.featureGrid}>
          {[
            { t: 'OAuth 2.0', d: 'Connect Gmail securely with token encryption.' },
            { t: 'Hostinger SMTP', d: 'Just add your mailbox password and start sending.' },
            { t: 'Smart Scheduler', d: 'Set it and forget it. Auto-sends at your chosen time.' },
          ].map((f, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={styles.card}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{f.t}</h3>
              <p style={{ color: '#475569', lineHeight: 1.6 }}>{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '40px', textAlign: 'center', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
        © {new Date().getFullYear()} CertWinX. All rights reserved.
      </footer>
    </div>
  );
}
