import { describe, it, expect } from 'vitest';
import { rateLimit } from '../src/lib/ratelimit';
describe('ratelimit', () => {
  it('allows up to max within window', () => { const key = 'test-' + Math.random(); expect(rateLimit(key, 2, 1000)).toBe(true); expect(rateLimit(key, 2, 1000)).toBe(true); expect(rateLimit(key, 2, 1000)).toBe(false); });
});
