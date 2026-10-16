# CertWinX — Email Campaign Automation

Self-hosted email campaign management for teams that send from **their own Gmail or Hostinger Mail accounts**, using **Supabase** for storage and **Vercel** for hosting. Built with Next.js App Router + TypeScript.

> **Honesty first.** CertWinX is not affiliated with Google or Hostinger. It does not guarantee inbox placement, unlimited sending, or bypassing provider limits. "Accepted" means the provider accepted the message for delivery; it is **not** proof of inbox placement.

## Supported senders

| Provider | Auth | Transport |
|---|---|---|
| **Gmail / Google Workspace** | OAuth 2.0 | Gmail API (`gmail.send`) |
| **Hostinger Mail** | Email password | SMTP (`smtp.hostinger.com`) |
| **Titan Email (via Hostinger)** | Email password | SMTP (`smtp.titan.email`) |

## 1. Requirements
- Node.js **20+**, Supabase project, Google Cloud OAuth credentials (for Gmail), Hostinger email-enabled plan (for Hostinger SMTP), Vercel account, `git` and `npm`.

## 2. Local setup
```bash
chmod +x bootstrap.sh
./bootstrap.sh
cd certwinx
cp .env.example .env.local
# edit .env.local — fill all values
npm install
npm run dev
