import { LIMITS } from '../../../shared/schemas';

/**
 * 8-hour (28,800,000 ms) cooldown between automatic browser permission reminder banners (RF-27).
 */
export const PERMISSION_COOLDOWN_MS = 8 * 60 * 60 * 1000;

/**
 * 30-day retention and catch-up window for notification records (RF-28, RF-29, Appendix B).
 */
export const RETENTION_WINDOW_MS = LIMITS.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Maximum safe 32-bit signed integer delay for setTimeout (2^31 - 1 ms, ~24.85 days).
 * Multi-week timers chain chunks capped at this value so delays never overflow and fire immediately.
 */
export const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;
