#!/usr/bin/env bash
# CertWinX: OPAL-style Editorial Dark Landing Page
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# Ensure framer-motion is installed
say "Installing framer-motion (if not present)..."
npm install framer-motion --silent

# =============================================================
# 1. Update Layout to include Serif Font
# =============================================================
backup "src/app/layout.tsx"
write "src/app/layout.tsx" <<'EOF'
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });

export const metadata: Metadata = {
  title: 'CertWinX — Email Campaign Automation',
  description: 'Self-hosted email campaign automation for Gmail and Hostinger.',
};

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
EOF

# =============================================================
# 2. Append OPAL Editorial CSS
# =============================================================
MARK="/* OPAL Editorial Landing v1 */"
if ! grep -qF "$MARK" "src/app/globals.css" 2>/dev/null; then
  cat >> "src/app/globals.css" <<'EOF'

/* OPAL Editorial Landing v1 */
:root {
  --bg-black: #050505;
  --text-white: #FAFAFA;
  --text-muted: #888888;
  --accent-blue: #7DA9CC; /* Pale desaturated blue */
  --accent-mid: #4A77A8;
  --hero-pin-distance: 400vh;
  --line-color: rgba(255, 255, 255, 0.1);
}

.opal-body {
  background-color: var(--bg-black);
  color: var(--text-white);
  font-family: var(--font-inter), sans-serif;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* Scanline Texture */
.scanlines {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
  opacity: 0.4;
}

/* Typography */
.opal-serif {
  font-family: var(--font-playfair), serif;
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 0.95;
}

.opal-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 500;
}

/* Nav */
.opal-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  z-index: 100;
  background: rgba(5, 5, 5, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line-color);
  transform: translateY(-100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.opal-nav.visible {
  transform: translateY(0);
}
.opal-nav .center-link {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: var(--text-white);
  text-decoration: none;
}
.opal-nav .btn {
  border: none;
  border-radius: 2px;
  padding: 10px 24px;
  background: var(--text-white);
  color: var(--bg-black);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.3s ease;
}
.opal-nav .btn:hover {
  background: var(--accent-blue);
}

/* Hero Scroll Section */
.opal-hero-container {
  height: var(--hero-pin-distance);
  position: relative;
}
.opal-hero-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Media Placeholder */
.opal-media-slot {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, #1a1a1a 0%, #050505 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.opal-media-slot::before {
  content: 'MEDIA SLOT';
  color: rgba(255,255,255,0.05);
  font-size: 10vw;
  font-family: var(--font-inter);
  font-weight: 800;
}

/* Scrims */
.opal-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%);
}
.opal-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #050505 0%, transparent 60%);
}

/* Hero UI */
.hero-label-tl { position: absolute; top: 40px; left: 40px; color: var(--text-white); z-index: 10; }
.hero-label-tr { position: absolute; top: 40px; right: 40px; color: var(--accent-blue); text-align: right; z-index: 10; }
.hero-counter { position: absolute; bottom: 40px; right: 40px; font-size: 14px; font-weight: 500; z-index: 10; letter-spacing: 0.1em; }

/* Screens */
.hero-screen {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 10vw;
  z-index: 5;
  pointer-events: none;
}
.hero-screen.left { justify-content: flex-start; }
.hero-screen.right { justify-content: flex-end; }

.caption-block {
  max-width: 500px;
  pointer-events: auto;
}
.caption-eyebrow {
  color: var(--accent-blue);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 20px;
}
.caption-lede {
  font-size: 20px;
  color: var(--text-muted);
  margin-bottom: 10px;
  font-family: var(--font-inter);
}
.caption-headline {
  font-family: var(--font-playfair);
  font-size: clamp(48px, 6vw, 80px);
  font-weight: 300;
  line-height: 1;
  margin-bottom: 30px;
  color: var(--text-white);
}

/* Buttons */
.btn-primary, .btn-secondary {
  display: inline-block;
  padding: 16px 32px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
}
.btn-primary {
  background: var(--text-white);
  color: var(--bg-black);
  border: 1px solid var(--text-white);
  position: relative;
  overflow: hidden;
}
.btn-primary::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transition: left 0.5s ease;
}
.btn-primary:hover::after { left: 100%; }
.btn-secondary {
  background: transparent;
  color: var(--text-white);
  border: 1px solid var(--line-color);
}
.btn-secondary:hover { border-color: var(--text-white); }

/* Studio Section */
.opal-studio {
  padding: 15vh 10vw;
  position: relative;
  background: var(--bg-black);
  border-top: 1px solid var(--line-color);
}
.studio-title {
  font-family: var(--font-playfair);
  font-size: clamp(60px, 10vw, 140px);
  font-weight: 300;
  text-align: right;
  line-height: 0.9;
  margin: 20px 0 80px 0;
  position: relative;
}
.studio-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
}
.studio-left p {
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-muted);
  max-width: 400px;
  margin-bottom: 40px;
}
.studio-actions { display: flex; gap: 16px; }
.studio-facts { display: flex; flex-direction: column; gap: 40px; }
.fact-item { border-top: 1px solid var(--line-color); padding-top: 20px; }
.fact-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--accent-blue); margin-bottom: 8px; display: block; }
.fact-value { font-size: 16px; color: var(--text-white); font-family: var(--font-inter); }

/* Background Glows */
.studio-glow {
  position: absolute;
  width: 400px; height: 400px;
  background: radial-gradient(circle, var(--accent-blue) 0%, transparent 70%);
  opacity: 0.15;
  filter: blur(80px);
  top: 10%; right: 5%;
  pointer-events: none;
}

/* Footer */
.opal-footer {
  padding: 80px 0 40px;
  border-top: 1px solid var(--line-color);
  overflow: hidden;
  position: relative;
}
.footer-wordmark {
  font-family: var(--font-playfair);
  font-size: 15vw;
  font-weight: 300;
  line-height: 0.7;
  text-align: center;
  white-space: nowrap;
  color: var(--text-white);
  position: relative;
  z-index: 2;
}
.footer-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 50vw; height: 100px;
  background: var(--accent-blue);
  filter: blur(100px);
  opacity: 0.2;
  z-index: 1;
}
.footer-bottom {
  display: flex;
  justify-content: space-between;
  padding: 40px 10vw 0;
  margin-top: 40px;
  border-top: 1px solid var(--line-color);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}
.footer-links { display: flex; gap: 20px; }
.footer-links a { color: var(--text-white); text-decoration: none; }

@media (max-width: 768px) {
  .studio-grid { grid-template-columns: 1fr; gap: 40px; }
  .hero-screen { padding: 0 5vw; justify-content: center !important; text-align: center; }
  .footer-bottom { flex-direction: column; gap: 20px; align-items: center; }
}
EOF
  say "appended OPAL CSS"
fi

# =============================================================
# 3. Rewrite Landing Page with Framer Motion
# =============================================================
backup "src/app/page.tsx"
write "src/app/page.tsx" <<'EOF'
/* eslint-disable react/no-unescaped-entities */
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [navVisible, setNavVisible] = useState(false);
  
  // Track scroll for the hero pin
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"]
  });

  // Hide/show nav based on scroll
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    setNavVisible(latest > 100);
  });

  // Media scale (scales down slightly as you scroll)
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  // Caption Opacities mapping
  // Screen 1: visible 0.0 - 0.33, fades out at 0.33
  const opacity1 = useTransform(scrollYProgress, [0, 0.05, 0.3, 0.35], [1, 1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0, 0.35], [0, -50]);

  // Screen 2: fades in at 0.33, visible till 0.66
  const opacity2 = useTransform(scrollYProgress, [0.3, 0.35, 0.6, 0.65], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.3, 0.65], [50, -50]);

  // Screen 3: fades in at 0.66, visible till 1.0
  const opacity3 = useTransform(scrollYProgress, [0.6, 0.65, 0.95, 1], [0, 1, 1, 0]);
  const y3 = useTransform(scrollYProgress, [0.6, 1], [50, -50]);

  // Counter text
  const [counter, setCounter] = useState('01');
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.33) setCounter('01');
    else if (latest < 0.66) setCounter('02');
    else setCounter('03');
  });

  // Fade up for studio section
  const studioRef = useRef<HTMLDivElement>(null);
  const studioScroll = useScroll({ target: studioRef, offset: ["start end", "center center"] });
  const studioOpacity = useTransform(studioScroll.scrollYProgress, [0, 1], [0, 1]);
  const studioY = useTransform(studioScroll.scrollYProgress, [0, 1], [100, 0]);

  return (
    <div className="opal-body">
      <div className="scanlines" />

      {/* NAV */}
      <nav className={`opal-nav ${navVisible ? 'visible' : ''}`} aria-hidden={!navVisible}>
        <div className="opal-label" style={{ fontSize: 16, letterSpacing: '0.2em', fontWeight: 600 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>CERTWINX</Link>
        </div>
        <a href="#studio" className="center-link opal-label">Studio</a>
        <Link href="/signup" className="btn">Sign Up</Link>
      </nav>

      {/* HERO */}
      <div className="opal-hero-container" ref={heroRef}>
        <div className="opal-hero-sticky">
          
          {/* Media Placeholder */}
          <motion.div className="opal-media-slot" style={{ scale: mediaScale }} />

          {/* Scrims */}
          <div className="opal-vignette" />
          <div className="opal-scrim" />

          {/* Labels */}
          <div className="hero-label-tl opal-label">
            CERTWINX / Email Automation
          </div>
          <div className="hero-label-tr opal-label">
            Global / Est. 2024
          </div>
          <div className="hero-counter">
            {counter} / 03
          </div>

          {/* SCREEN 1 */}
          <motion.div className="hero-screen left" style={{ opacity: opacity1, y: y1 }}>
            <div className="caption-block">
              <div className="caption-eyebrow">Campaigns, engineered before they are sent</div>
              <div className="caption-lede">Anyone can send a bulk email.</div>
              <h1 className="caption-headline">Want more?</h1>
              <div style={{ display: 'flex', gap: 16 }}>
                <Link href="/signup" className="btn-primary">Start sending</Link>
                <a href="#studio" className="btn-secondary">See features</a>
              </div>
            </div>
          </motion.div>

          {/* SCREEN 2 */}
          <motion.div className="hero-screen right" style={{ opacity: opacity2, y: y2 }}>
            <div className="caption-block">
              <div className="caption-lede">Every campaign leaves as a one-off.</div>
              <h1 className="caption-headline">Unique delivery</h1>
            </div>
          </motion.div>

          {/* SCREEN 3 */}
          <motion.div className="hero-screen left" style={{ opacity: opacity3, y: y3 }}>
            <div className="caption-block">
              <div className="caption-lede">Two clicks. One dashboard. Unlimited scale.</div>
              <h1 className="caption-headline">Unique you</h1>
            </div>
          </motion.div>

        </div>
      </div>

      {/* STUDIO SECTION */}
      <section className="opal-studio" id="studio" ref={studioRef}>
        <div className="studio-glow" />
        
        <motion.div style={{ opacity: studioOpacity, y: studioY }}>
          <div className="opal-label" style={{ color: 'var(--accent-blue)' }}>The engine</div>
          
          <h2 className="studio-title">
            Get your unique<br />experience
          </h2>

          <div className="studio-grid">
            <div className="studio-left">
              <p>
                Send a campaign and watch it land, or sit down with nothing and we design it in front of you. 
                OAuth and SMTP are agreed before a mail is opened. Shape, length, and finish are decided before a single byte is sent.
              </p>
              <div className="studio-actions">
                <Link href="/signup" className="btn-primary">Start a campaign</Link>
                <Link href="/contact" className="btn-secondary">Contact us</Link>
              </div>
            </div>

            <div className="studio-facts">
              <div className="fact-item">
                <span className="fact-label">Protocol</span>
                <div className="fact-value">AES-256 Encrypted</div>
              </div>
              <div className="fact-item">
                <span className="fact-label">Scale</span>
                <div className="fact-value">Up to 3,000 emails per day</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="opal-footer">
        <div className="footer-glow" />
        <div className="footer-wordmark">CERTWINX</div>
        
        <div className="footer-bottom">
          <div className="footer-links">
            <a href="#">Instagram</a>
            <a href="#">Twitter</a>
          </div>
          <div>Global, 2026</div>
        </div>
      </footer>

    </div>
  );
}
EOF

say ""
say "✅ OPAL-style Editorial Landing Page applied."
say ""
say "Note: This completely replaces your old light-theme landing page."
say ""
say "Run:"
say "  npm run build"
say "  git add . && git commit -m 'feat: dark editorial scroll-driven landing page' && git push"