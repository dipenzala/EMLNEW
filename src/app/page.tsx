/* eslint-disable react/no-unescaped-entities */
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [navVisible, setNavVisible] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end end"] });
  const { scrollY } = useScroll();
  
  useMotionValueEvent(scrollY, "change", (latest) => setNavVisible(latest > 100));
  
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const opacity1 = useTransform(scrollYProgress, [0, 0.05, 0.3, 0.35], [1, 1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0, 0.35], [0, -50]);
  const opacity2 = useTransform(scrollYProgress, [0.3, 0.35, 0.6, 0.65], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.3, 0.65], [50, -50]);
  const opacity3 = useTransform(scrollYProgress, [0.6, 0.65, 0.95, 1], [0, 1, 1, 0]);
  const y3 = useTransform(scrollYProgress, [0.6, 1], [50, -50]);
  const [counter, setCounter] = useState('01');
  
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.33) setCounter('01');
    else if (latest < 0.66) setCounter('02');
    else setCounter('03');
  });

  return (
    <div style={{ backgroundColor: '#050505', color: '#FAFAFA', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', zIndex: 100, background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #222', transform: navVisible ? 'translateY(0)' : 'translateY(-100%)', transition: 'transform 0.4s ease' }}>
        <div style={{ fontSize: 20, letterSpacing: '0.2em', fontWeight: 600 }}><Link href="/" style={{color:'inherit', textDecoration:'none'}}>CERTWINX</Link></div>
        <a href="#studio" style={{ color: '#fff', textDecoration: 'none', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Features</a>
        <Link href="/signup" style={{ background: '#fff', color: '#000', padding: '10px 24px', borderRadius: 2, textDecoration: 'none', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Sign Up</Link>
      </nav>

      <div ref={heroRef} style={{ height: '300vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, #1a1a1a 0%, #050505 100%)', scale: mediaScale }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #050505 0%, transparent 60%)' }} />
          
          <div style={{ position: 'absolute', top: 40, left: 40, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>CERTWINX / EMAIL AUTOMATION</div>
          <div style={{ position: 'absolute', top: 40, right: 40, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7DA9CC' }}>GLOBAL / EST. 2024</div>
          <div style={{ position: 'absolute', bottom: 40, right: 40, fontSize: 14, letterSpacing: '0.1em' }}>{counter} / 03</div>

          <motion.div style={{ position: 'absolute', left: '10vw', maxWidth: 500, opacity: opacity1, y: y1 }}>
            <div style={{ color: '#7DA9CC', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 20 }}>Campaigns, engineered</div>
            <div style={{ fontSize: 20, color: '#888', marginBottom: 10 }}>Anyone can send a bulk email.</div>
            <h1 style={{ fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: 300, lineHeight: 1, marginBottom: 30, fontFamily: 'serif' }}>Want more?</h1>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link href="/signup" style={{ background: '#fff', color: '#000', padding: '16px 32px', borderRadius: 2, textDecoration: 'none', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Start sending</Link>
            </div>
          </motion.div>

          <motion.div style={{ position: 'absolute', right: '10vw', maxWidth: 500, opacity: opacity2, y: y2, textAlign: 'right' }}>
            <div style={{ fontSize: 20, color: '#888', marginBottom: 10 }}>Every campaign leaves as a one-off.</div>
            <h1 style={{ fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: 300, lineHeight: 1, fontFamily: 'serif' }}>Unique delivery</h1>
          </motion.div>

          <motion.div style={{ position: 'absolute', left: '10vw', maxWidth: 500, opacity: opacity3, y: y3 }}>
            <div style={{ fontSize: 20, color: '#888', marginBottom: 10 }}>Two clicks. One dashboard. Unlimited scale.</div>
            <h1 style={{ fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: 300, lineHeight: 1, fontFamily: 'serif' }}>Unique you</h1>
          </motion.div>
        </div>
      </div>

      <section id="studio" style={{ padding: '15vh 10vw', borderTop: '1px solid #222' }}>
        <div style={{ color: '#7DA9CC', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>The engine</div>
        <h2 style={{ fontSize: 'clamp(60px, 10vw, 140px)', fontWeight: 300, textAlign: 'right', lineHeight: 0.9, margin: '20px 0 80px 0', fontFamily: 'serif' }}>Get your unique<br />experience</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
          <div>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: '#888', maxWidth: 400, marginBottom: 40 }}>Send a campaign and watch it land. OAuth and SMTP are agreed before a mail is opened. Shape, length, and finish are decided before a single byte is sent.</p>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link href="/signup" style={{ background: '#fff', color: '#000', padding: '16px 32px', borderRadius: 2, textDecoration: 'none', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Start a campaign</Link>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
             <div style={{ borderTop: '1px solid #222', paddingTop: 20 }}>
               <div style={{ color: '#7DA9CC', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Protocol</div>
               <div style={{ fontSize: 16 }}>AES-256 Encrypted</div>
             </div>
             <div style={{ borderTop: '1px solid #222', paddingTop: 20 }}>
               <div style={{ color: '#7DA9CC', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Scale</div>
               <div style={{ fontSize: 16 }}>Up to 3,000 emails per day</div>
             </div>
          </div>
        </div>
      </section>

      <footer style={{ padding: '80px 0 40px', borderTop: '1px solid #222', textAlign: 'center' }}>
        <div style={{ fontSize: '15vw', fontWeight: 300, lineHeight: 0.7, fontFamily: 'serif', color: '#fff' }}>CERTWINX</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '40px 10vw 0', marginTop: 40, borderTop: '1px solid #222', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888' }}>
          <div>Instagram &nbsp; Twitter</div>
          <div>Global, 2026</div>
        </div>
      </footer>
    </div>
  );
}
