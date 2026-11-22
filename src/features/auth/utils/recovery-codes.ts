import { es } from '../../../shared/i18n';
import { LIMITS, type RecoveryCode } from '../../../shared/schemas';

/**
 * Single-use alphanumeric recovery code generation, validation, and normalization utilities (RF-01, RF-03, REQ-BI-13).
 */

const RECOVERY_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Rejection threshold to eliminate modulo bias (floor(256 / 36) * 36 = 252).
const MAX_UNBIASED_BYTE = 252;

export type RecoveryCodeValidationResult =
  | { ok: true; stripped8: string }
  | { ok: false; error: string };

export interface RandomValuesProvider {
  getRandomValues: Crypto['getRandomValues'];
}

function generateSingleCode(randomProvider: RandomValuesProvider): string {
  const buffer = new Uint8Array(16);
  let code = '';

  while (code.length < LIMITS.RECOVERY_CODE_LENGTH) {
    randomProvider.getRandomValues(buffer);
    for (let i = 0; i < buffer.length && code.length < LIMITS.RECOVERY_CODE_LENGTH; i += 1) {
      const byte = buffer[i];
      if (byte < MAX_UNBIASED_BYTE) {
        code += RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length];
      }
    }
  }

  return code;
}

/**
 * Generates `count` unique 8-character uppercase alphanumeric `[A-Z0-9]{8}` recovery codes.
 */
export function generateRecoveryCodes(
  count: number = LIMITS.RECOVERY_CODES_COUNT,
  provider?: RandomValuesProvider,
): string[] {
  const randomProvider = provider ?? globalThis.crypto;
  if (!randomProvider || typeof randomProvider.getRandomValues !== 'function') {
    throw new Error('CSPRNG getRandomValues is not available in this environment.');
  }

  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateSingleCode(randomProvider));
  }

  return Array.from(codes);
}

/**
 * Validates user-entered recovery codes accepting both `XXXXXXXX` and `XXXX-XXXX` formats.
 */
export function validateRecoveryCodeFormat(raw: string): RecoveryCodeValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: es.auth.recoveryCodeRequired };
  }

  if (/[^A-Za-z0-9-]/.test(trimmed)) {
    return { ok: false, error: es.auth.recoveryCodeFormatError };
  }

  const hyphenCount = (trimmed.match(/-/g) ?? []).length;
  if (hyphenCount > 1) {
    return { ok: false, error: es.auth.recoveryCodeFormatError };
  }

  const stripped = trimmed.replace(/-/g, '').toUpperCase();
  if (hyphenCount === 1 && !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(trimmed)) {
    if (stripped.length !== LIMITS.RECOVERY_CODE_LENGTH) {
      return { ok: false, error: es.auth.recoveryCodeLengthError };
    }
    return { ok: false, error: es.auth.recoveryCodeFormatError };
  }

  if (stripped.length !== LIMITS.RECOVERY_CODE_LENGTH) {
    return { ok: false, error: es.auth.recoveryCodeLengthError };
  }

  return { ok: true, stripped8: stripped };
}

/**
 * Normalizes a recovery code to canonical unhyphenated uppercase `XXXXXXXX` for localStorage mode.
 */
export function normalizeRecoveryCodeForLocalStorage(code: string): string {
  return code.trim().replace(/-/g, '').toUpperCase();
}

/**
 * Normalizes a recovery code to canonical hyphenated uppercase `XXXX-XXXX` for REST API mode.
 */
export function normalizeRecoveryCodeForApi(code: string): string {
  const stripped = normalizeRecoveryCodeForLocalStorage(code);
  return `${stripped.slice(0, 4)}-${stripped.slice(4, 8)}`;
}

/**
 * Backward-compatible alias normalizing recovery codes for localStorage matching.
 */
export function normalizeRecoveryCode(code: string): string {
  return normalizeRecoveryCodeForLocalStorage(code);
}

/**
 * Builds persisted `RecoveryCode` records linked to `userId`.
 */
export function buildRecoveryCodeRecords(
  userId: string,
  plainCodes: readonly string[],
  createId: () => string = () => globalThis.crypto.randomUUID(),
): RecoveryCode[] {
  return plainCodes.map((code) => ({
    id: createId(),
    userId,
    code: normalizeRecoveryCode(code),
    used: false,
    usedAt: null,
  }));
}
