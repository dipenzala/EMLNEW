import { z } from 'zod';
const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  GOOGLE_CLIENT_ID: z.string().min(5).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(5).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(20).optional(),
  CRON_SECRET: z.string().min(8).optional(),
  AUTH_SECRET: z.string().min(8).optional(),
  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  MAX_EMAILS_PER_SENDER_24H: z.coerce.number().int().min(1).max(350).default(350),
  MAX_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(5),
  GLOBAL_SENDING_ENABLED: z.string().default('false'),
  DEMO_MODE: z.string().default('true'),
});
export type Env = z.infer<typeof schema>;
let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) throw new Error('Invalid environment: ' + parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; '));
  cached = parsed.data;
  return cached;
}
