import { describe, expect, it } from 'vitest';
import {
  buildRecoveryCodeRecords,
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from '@/features/auth/utils/recovery-codes';
import { LIMITS } from '@/shared/schemas';

describe('recovery-codes utilities', () => {
  it('generates 8 unique 8-character uppercase alphanumeric codes by default', () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(LIMITS.RECOVERY_CODES_COUNT);
    expect(new Set(codes).size).toBe(LIMITS.RECOVERY_CODES_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it('normalizes recovery codes by trimming whitespace and uppercasing', () => {
    expect(normalizeRecoveryCode(' ab12cd34 ')).toBe('AB12CD34');
    expect(normalizeRecoveryCode('XyZ98765')).toBe('XYZ98765');
  });

  it('builds RecoveryCode records linked to userId with used: false and usedAt: null', () => {
    const records = buildRecoveryCodeRecords('user-1', ['ab12cd34', 'EF56GH78']);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      userId: 'user-1',
      code: 'AB12CD34',
      used: false,
      usedAt: null,
    });
    expect(records[0]?.id).toBeTruthy();
    expect(records[1]?.id).not.toBe(records[0]?.id);
  });
});
