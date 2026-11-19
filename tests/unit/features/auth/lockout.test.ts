import { describe, expect, it } from 'vitest';
import {
  evaluateNextLockoutState,
  formatLockoutMessage,
  getLockoutRemainingMs,
  isLockedOut,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  normalizeEmail,
} from '@/features/auth/utils/lockout';
import { es } from '@/shared/i18n';
import type { LoginLockoutState } from '@/shared/schemas';

describe('lockout utilities (RNF-06, REQ-AU-06)', () => {
  const baseNow = Date.parse('2026-11-15T12:00:00.000Z');

  it('normalizes email by trimming and lowercasing', () => {
    expect(normalizeEmail('  Ana.Garcia@Example.COM  ')).toBe('ana.garcia@example.com');
  });

  it('increments attempts 1..4 without setting lockedUntil and locks on 5th attempt for 5 minutes', () => {
    let state: LoginLockoutState | null = null;

    for (let attempt = 1; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      state = evaluateNextLockoutState('User@Test.com', state, baseNow + attempt * 1000);
      expect(state).toEqual({
        normalizedEmail: 'user@test.com',
        failedAttempts: attempt,
        lockedUntil: null,
      });
      expect(isLockedOut(state, baseNow + attempt * 1000)).toBe(false);
    }

    const fifthNow = baseNow + 10_000;
    const lockedState = evaluateNextLockoutState('User@Test.com', state, fifthNow);
    expect(lockedState).toEqual({
      normalizedEmail: 'user@test.com',
      failedAttempts: 5,
      lockedUntil: new Date(fifthNow + LOCKOUT_DURATION_MS).toISOString(),
    });
    expect(isLockedOut(lockedState, fifthNow)).toBe(true);
    expect(getLockoutRemainingMs(lockedState, fifthNow)).toBe(LOCKOUT_DURATION_MS);
  });

  it('resets expired lockout counter to 0 before evaluating next failed attempt', () => {
    const expiredState: LoginLockoutState = {
      normalizedEmail: 'user@test.com',
      failedAttempts: 5,
      lockedUntil: new Date(baseNow).toISOString(),
    };

    expect(isLockedOut(expiredState, baseNow)).toBe(false);
    expect(getLockoutRemainingMs(expiredState, baseNow)).toBe(0);

    const nextState = evaluateNextLockoutState('user@test.com', expiredState, baseNow);
    expect(nextState).toEqual({
      normalizedEmail: 'user@test.com',
      failedAttempts: 1,
      lockedUntil: null,
    });
  });

  it('keeps active lockout untouched when evaluated during cooldown', () => {
    const activeState: LoginLockoutState = {
      normalizedEmail: 'user@test.com',
      failedAttempts: 5,
      lockedUntil: new Date(baseNow + 120_000).toISOString(),
    };

    const nextState = evaluateNextLockoutState('user@test.com', activeState, baseNow + 10_000);
    expect(nextState).toEqual(activeState);
  });

  it('formats remaining lockout duration in minutes (>= 60_000 ms) or seconds (< 60_000 ms)', () => {
    expect(formatLockoutMessage(300_000)).toBe(es.auth.tooManyAttemptsMinutes(5));
    expect(formatLockoutMessage(60_001)).toBe(es.auth.tooManyAttemptsMinutes(2));
    expect(formatLockoutMessage(60_000)).toBe(es.auth.tooManyAttemptsMinutes(1));
    expect(formatLockoutMessage(59_999)).toBe(es.auth.tooManyAttemptsSeconds(60));
    expect(formatLockoutMessage(15_200)).toBe(es.auth.tooManyAttemptsSeconds(16));
    expect(formatLockoutMessage(1)).toBe(es.auth.tooManyAttemptsSeconds(1));
    expect(formatLockoutMessage(0)).toBe('');
  });
});
