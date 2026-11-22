import { describe, expect, it } from 'vitest';
import {
  normalizeRecoveryCode,
  normalizeRecoveryCodeForApi,
  normalizeRecoveryCodeForLocalStorage,
  validateRecoveryCodeFormat,
} from '@/features/auth/utils/recovery-codes';
import { es } from '@/shared/i18n';

describe('Recovery-Code Dual Validation & Normalization (REQ-BI-13)', () => {
  it('accepts both unhyphenated XXXXXXXX and hyphenated XXXX-XXXX codes case-insensitively with surrounding whitespace', () => {
    expect(validateRecoveryCodeFormat('  a1b2c3d4  ')).toEqual({
      ok: true,
      stripped8: 'A1B2C3D4',
    });
    expect(validateRecoveryCodeFormat('  a1b2-c3d4  ')).toEqual({
      ok: true,
      stripped8: 'A1B2C3D4',
    });
    expect(validateRecoveryCodeFormat('Z9Y8-X7W6')).toEqual({
      ok: true,
      stripped8: 'Z9Y8X7W6',
    });
  });

  it('returns reconciled Spanish validation errors for empty, bad chars, misplaced hyphens, and wrong lengths', () => {
    expect(validateRecoveryCodeFormat('')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeRequired,
    });
    expect(validateRecoveryCodeFormat('   ')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeRequired,
    });

    expect(validateRecoveryCodeFormat('A1B2_C3D')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeFormatError,
    });
    expect(validateRecoveryCodeFormat('A1-B2-C3')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeFormatError,
    });
    expect(validateRecoveryCodeFormat('AB-CDEFGH')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeFormatError,
    });

    expect(validateRecoveryCodeFormat('ABC123')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeLengthError,
    });
    expect(validateRecoveryCodeFormat('ABCD-123')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeLengthError,
    });
    expect(validateRecoveryCodeFormat('A1B2C3D4E5')).toEqual({
      ok: false,
      error: es.auth.recoveryCodeLengthError,
    });
  });

  it('normalizes to XXXXXXXX for localStorage mode and XXXX-XXXX for api mode', () => {
    expect(normalizeRecoveryCodeForLocalStorage(' a1b2-c3d4 ')).toBe('A1B2C3D4');
    expect(normalizeRecoveryCodeForLocalStorage('a1b2c3d4')).toBe('A1B2C3D4');
    expect(normalizeRecoveryCode(' a1b2-c3d4 ')).toBe('A1B2C3D4');

    expect(normalizeRecoveryCodeForApi(' a1b2c3d4 ')).toBe('A1B2-C3D4');
    expect(normalizeRecoveryCodeForApi('a1b2-c3d4')).toBe('A1B2-C3D4');
  });
});
