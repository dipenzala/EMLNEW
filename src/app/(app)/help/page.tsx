export default function HelpPage() {
  return (
    <>
      <div className="topbar"><h1>Help &amp; troubleshooting</h1></div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Google OAuth issues</h3>
          <ul style={{ color: '#475569', fontSize: 14 }}>
            <li><strong>redirect_uri_mismatch</strong> — the URI in Google Cloud console must match GOOGLE_REDIRECT_URI exactly.</li>
            <li><strong>access_denied</strong> — testing mode; add your account as a test user.</li>
            <li><strong>invalid_grant</strong> — token expired/revoked; reconnect the sender.</li>
            <li>gmail.send is a sensitive scope; external users may require Google verification.</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Hostinger Mail setup</h3>
          <ul style={{ color: '#475569', fontSize: 14 }}>
            <li><strong>SMTP host</strong> — Hostinger Email: <code>smtp.hostinger.com</code>. Titan (Hostinger ke saath bundled): <code>smtp.titan.email</code>.</li>
            <li><strong>Auth failed</strong> — email mailbox password use karo (wahi jo hPanel → Emails me set kiya). Special chars ho to copy-paste karo.</li>
            <li><strong>Ports</strong> — 465 (SSL) recommended; 587 (STARTTLS) bhi chalta hai.</li>
            <li><strong>From mismatch</strong> — jo email hPanel me create kiya wahi daalo. Alias/different domain se send nahi hoga.</li>
            <li><strong>Plan</strong> — SMTP access Hostinger ke email-enabled plans me milta hai. Email plan active hona chahiye.</li>
            <li>Ek account ke liye ek entry — dobara connect karne par update ho jaata hai.</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Vercel Cron</h3>
          <ul style={{ color: '#475569', fontSize: 14 }}>
            <li>Hobby plan cron = daily only. Minute-level schedules require Pro.</li>
            <li>Set CRON_SECRET in env; cron route requires <code>Authorization: Bearer $CRON_SECRET</code>.</li>
            <li>Use Settings → “Process next batch” for manual runs.</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sending paused</h3>
          <p style={{ color: '#475569', fontSize: 14 }}>Sending is gated by <code>GLOBAL_SENDING_ENABLED=true</code> and the profile toggle. Both must be on.</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Deliverability</h3>
          <p style={{ color: '#475569', fontSize: 14 }}>CertWinX cannot guarantee inbox placement. Provider accepting a message is not proof of delivery.</p>
        </div>
      </div>
    </>
  );
}
