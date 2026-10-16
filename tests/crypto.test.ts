import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64'); });
describe('crypto', () => {
  it('encrypts and decrypts round-trip', async () => { const { encrypt, decrypt } = await import('../src/lib/crypto'); const pt = 'refresh-token-value-xyz'; const ct = encrypt(pt); expect(ct).not.toContain(pt); expect(decrypt(ct)).toBe(pt); });
  it('rejects invalid key length', async () => { const { encrypt } = await import('../src/lib/crypto'); process.env.TOKEN_ENCRYPTION_KEY = Buffer.from('short').toString('base64'); expect(() => encrypt('x')).toThrow(); process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64'); });
  it('timing safe eq works', async () => { const { timingSafeEq } = await import('../src/lib/crypto'); expect(timingSafeEq('abc', 'abc')).toBe(true); expect(timingSafeEq('abc', 'abd')).toBe(false); expect(timingSafeEq('abc', 'abcd')).toBe(false); });
});
