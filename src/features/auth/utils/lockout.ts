import { es } from '../../../shared/i18n';
import type { LoginLockoutState } from '../../../shared/schemas';

/**
 * Pure login lockout state evaluator and Spanish cooldown formatter (RNF-06, REQ-AU-06).
 */

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

/**
 * Normalizes an email address for case-insensitive lookup and lockout keying.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns remaining lockout duration in milliseconds, or `0` when unlocked/expired.
 */
export function getLockoutRemainingMs(
  state: LoginLockoutState | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!state?.lockedUntil) {
    return 0;
  }

  const lockedUntilMs = Date.parse(state.lockedUntil);
  if (!Number.isFinite(lockedUntilMs)) {
    return 0;
  }

  return Math.max(0, lockedUntilMs - nowMs);
}

/**
 * Returns `true` while `nowMs < lockedUntil`.
 */
export function isLockedOut(
  state: LoginLockoutState | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return getLockoutRemainingMs(state, nowMs) > 0;
}

/**
 * Formats the localized Spanish cooldown message per `REQ-AU-06(2)`.
 */
export function formatLockoutMessage(remainingMs: number): string {
  if (remainingMs <= 0) {
    return '';
  }

  if (remainingMs >= 60_000) {
    return es.auth.tooManyAttemptsMinutes(Math.ceil(remainingMs / 60_000));
  }

  return es.auth.tooManyAttemptsSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
}

/**
 * Computes the next persisted `LoginLockoutState` after a failed `/login` attempt.
 * Resets expired counters before incrementing and locks for 5 minutes on the 5th failure.
 */
export function evaluateNextLockoutState(
  email: string,
  previousState: LoginLockoutState | null | undefined,
  nowMs: number = Date.now(),
): LoginLockoutState {
  const normalized = normalizeEmail(email);

  if (previousState && isLockedOut(previousState, nowMs)) {
    return {
      normalizedEmail: normalized,
      failedAttempts: previousState.failedAttempts,
      lockedUntil: previousState.lockedUntil,
    };
  }

  // REQ-AU-06(4): Once now >= lockedUntil, reset expired attempt counter before next evaluation.
  const wasLockedAndExpired = Boolean(previousState?.lockedUntil) && !isLockedOut(previousState, nowMs);
  const previousAttempts = wasLockedAndExpired ? 0 : (previousState?.failedAttempts ?? 0);
  const nextAttempts = Math.min(MAX_FAILED_LOGIN_ATTEMPTS, previousAttempts + 1);
  const lockedUntil =
    nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
      ? new Date(nowMs + LOCKOUT_DURATION_MS).toISOString()
      : null;

  return {
    normalizedEmail: normalized,
    failedAttempts: nextAttempts,
    lockedUntil,
  };
}
