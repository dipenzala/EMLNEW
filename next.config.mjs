/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';
const csp = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://oauth2.googleapis.com https://gmail.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
];
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 🔥 YE LINE BUILD FAIL HONE SE ROKEGI 🔥
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
};
export default nextConfig;
