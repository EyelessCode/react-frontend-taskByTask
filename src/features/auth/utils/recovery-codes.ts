import { LIMITS, type RecoveryCode } from '../../../shared/schemas';

/**
 * Single-use alphanumeric recovery code generation and normalization utilities (RF-01, RF-03).
 */

const RECOVERY_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Rejection threshold to eliminate modulo bias (floor(256 / 36) * 36 = 252).
const MAX_UNBIASED_BYTE = 252;

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
 * Normalizes user-entered recovery codes by trimming whitespace and uppercasing.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase();
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
