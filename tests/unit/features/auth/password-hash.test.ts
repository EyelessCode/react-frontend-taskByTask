import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  hashPassword,
  PBKDF2_ITERATIONS,
  PBKDF2_PREFIX,
  verifyPassword,
} from '@/features/auth/utils/password-hash';

describe('password-hash utilities (WebCrypto PBKDF2-HMAC-SHA-256)', () => {
  it('produces a salted pbkdf2_sha256$100000$<32-hex>$<64-hex> hash that is non-reversible', async () => {
    const hash = await hashPassword('MiClaveSecreta123');
    const parts = hash.split('$');

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(PBKDF2_PREFIX);
    expect(Number(parts[1])).toBe(PBKDF2_ITERATIONS);
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('MiClaveSecreta123');
  });

  it('produces unique salts and hashes for the same password', async () => {
    const h1 = await hashPassword('SamePassword1');
    const h2 = await hashPassword('SamePassword1');

    expect(h1).not.toBe(h2);
    expect(await verifyPassword('SamePassword1', h1)).toBe(true);
    expect(await verifyPassword('SamePassword1', h2)).toBe(true);
  });

  it('preserves leading and trailing spaces in passwords without trimming', async () => {
    const hash = await hashPassword('  secret  ');

    expect(await verifyPassword('  secret  ', hash)).toBe(true);
    expect(await verifyPassword('secret', hash)).toBe(false);
    expect(await verifyPassword(' secret ', hash)).toBe(false);
  });

  it('rejects wrong passwords and malformed stored hashes safely', async () => {
    const hash = await hashPassword('CorrectHorse99');

    expect(await verifyPassword('WrongHorse99', hash)).toBe(false);
    expect(await verifyPassword('CorrectHorse99', '')).toBe(false);
    expect(await verifyPassword('CorrectHorse99', 'plaintext')).toBe(false);
    expect(await verifyPassword('CorrectHorse99', 'sha256$100000$abcd$ef01')).toBe(false);
    expect(await verifyPassword('CorrectHorse99', 'pbkdf2_sha256$0$abcd$ef01')).toBe(false);
    expect(await verifyPassword('CorrectHorse99', 'pbkdf2_sha256$100000$nothex$ef01')).toBe(false);
  });

  it('compares equal and unequal strings in constant time', () => {
    expect(constantTimeEqual('abcdef', 'abcdef')).toBe(true);
    expect(constantTimeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(constantTimeEqual('abcdef', 'abcde')).toBe(false);
  });
});
