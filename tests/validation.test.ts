import { describe, it, expect } from 'vitest';
import { campaignInput, settingsInput } from '../src/lib/validation';
describe('validation', () => {
  it('accepts valid campaign', () => { const r = campaignInput.safeParse({ name: 'x', subject: 'y', html: '', text_body: '', segment_tags: [] }); expect(r.success).toBe(true); });
  it('rejects oversized batch', () => { const r = settingsInput.safeParse({ batch_size: 999 }); expect(r.success).toBe(false); });
});
