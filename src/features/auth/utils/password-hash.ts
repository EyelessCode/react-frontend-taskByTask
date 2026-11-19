/**
 * Salted PBKDF2-HMAC-SHA-256 password hashing and constant-time verification (RNF-05).
 */

export const PBKDF2_PREFIX = 'pbkdf2_sha256';
export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES_LENGTH = 16;
const DERIVED_KEY_BITS = 256;
const HEX_SALT_REGEX = /^[0-9a-f]{32}$/;
const HEX_HASH_REGEX = /^[0-9a-f]{64}$/;

export interface CryptoProvider {
  getRandomValues: Crypto['getRandomValues'];
  subtle: Pick<SubtleCrypto, 'importKey' | 'deriveBits'>;
}

function resolveCryptoProvider(provider?: CryptoProvider): CryptoProvider {
  const cryptoApi = provider ?? globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function' || !cryptoApi.subtle) {
    throw new Error('WebCrypto API is not available in this environment.');
  }
  return cryptoApi;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function derivePbkdf2Hex(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  cryptoProvider: CryptoProvider,
): Promise<string> {
  const passwordBytes = Uint8Array.from(new TextEncoder().encode(password));
  const saltBytes = Uint8Array.from(salt);

  const baseKey = await cryptoProvider.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derivedBuffer = await cryptoProvider.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    baseKey,
    DERIVED_KEY_BITS,
  );

  return bytesToHex(new Uint8Array(derivedBuffer));
}

/**
 * Constant-time string comparison to avoid timing leaks on hash verification.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Hashes an untrimmed plaintext password using salted PBKDF2-HMAC-SHA-256.
 */
export async function hashPassword(
  password: string,
  provider?: CryptoProvider,
): Promise<string> {
  const cryptoProvider = resolveCryptoProvider(provider);
  const salt = new Uint8Array(SALT_BYTES_LENGTH);
  cryptoProvider.getRandomValues(salt);

  const derivedHex = await derivePbkdf2Hex(password, salt, PBKDF2_ITERATIONS, cryptoProvider);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${derivedHex}`;
}

/**
 * Verifies an untrimmed plaintext password against a stored `pbkdf2_sha256` hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  provider?: CryptoProvider,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [prefix, iterationsRaw, saltHex, expectedHex] = parts;
  if (prefix !== PBKDF2_PREFIX) {
    return false;
  }

  if (!/^\d+$/.test(iterationsRaw)) {
    return false;
  }
  const iterations = Number(iterationsRaw);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    return false;
  }

  if (!HEX_SALT_REGEX.test(saltHex) || !HEX_HASH_REGEX.test(expectedHex)) {
    return false;
  }

  const cryptoProvider = resolveCryptoProvider(provider);
  const saltBytes = hexToBytes(saltHex);
  const derivedHex = await derivePbkdf2Hex(password, saltBytes, iterations, cryptoProvider);

  return constantTimeEqual(derivedHex, expectedHex);
}
