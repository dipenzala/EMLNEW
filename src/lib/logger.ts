const SECRET_KEYS = ['authorization','cookie','set-cookie','token','refresh_token','access_token','client_secret','service_role','SUPABASE_SERVICE_ROLE_KEY','TOKEN_ENCRYPTION_KEY','CRON_SECRET','AUTH_SECRET','password','secret','app_password','smtp_password'];
export function redact(obj: unknown): unknown {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase())) ? '[redacted]' : redact(v);
    }
    return out;
  }
  if (typeof obj === 'string' && obj.length > 500) return obj.slice(0, 200) + '…[truncated]';
  return obj;
}
export function log(event: string, data: Record<string, unknown> = {}) { console.log(JSON.stringify({ t: new Date().toISOString(), event, ...redact(data) as object })); }
export function logError(event: string, err: unknown, data: Record<string, unknown> = {}) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ t: new Date().toISOString(), event, error: msg, ...redact(data) as object }));
}
