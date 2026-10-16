export default function PrivacyPage() {
  return (
    <div className="container" style={{ maxWidth: 780, padding: '48px 20px' }}>
      <h1>Privacy Policy</h1>
      <p style={{ color: '#64748B' }}>Operator-editable legal text. Replace with your own policy reviewed by counsel.</p>
      <h2>Data we process</h2>
      <p>Account data, sender OAuth tokens and SMTP credentials (encrypted), campaign content, recipient lists you supply, and delivery metadata reported by the provider APIs (Gmail / Hostinger).</p>
      <h2>Sub-processors</h2>
      <p>Supabase (database), Vercel (hosting), Google (Gmail API), Hostinger (SMTP). Configure and disclose additional sub-processors you use.</p>
      <h2>Your choices</h2>
      <p>Export or delete workspace data from Settings. Recipients can unsubscribe via the link included in every marketing email.</p>
    </div>
  );
}
