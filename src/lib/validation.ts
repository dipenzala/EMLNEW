import { z } from 'zod';
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const campaignInput = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(300),
  html: z.string().max(500_000).default(''),
  text_body: z.string().max(500_000).default(''),
  sender_account_id: z.string().uuid().nullable().optional(),
  segment_tags: z.array(z.string().min(1).max(64)).max(50).default([]),
  scheduled_at: z.string().datetime().nullable().optional(),
});
export const settingsInput = z.object({
  company_name: z.string().max(200).optional(),
  timezone: z.string().max(64).optional(),
  default_sender_id: z.string().uuid().nullable().optional(),
  batch_size: z.number().int().min(1).max(50).optional(),
  sender_daily_cap: z.number().int().min(1).max(350).optional(),
  global_sending_enabled: z.boolean().optional(),
});
