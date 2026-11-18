import type { BrowserNotificationPermissionState } from './browser-notifications';
import { PERMISSION_COOLDOWN_MS } from './notification-constants';

/**
 * Evaluates whether the discrete non-blocking browser notification permission banner
 * should be automatically displayed on workspace entry (REQ-NT-02, RF-27).
 */
export function isPermissionBannerDue(
  permission: BrowserNotificationPermissionState,
  lastShownAt: string | null,
  nowMs: number,
): boolean {
  if (permission !== 'default' && permission !== 'denied') {
    return false;
  }

  if (lastShownAt === null) {
    return true;
  }

  const parsedMs = Date.parse(lastShownAt);
  if (Number.isNaN(parsedMs)) {
    return true;
  }

  return nowMs - parsedMs >= PERMISSION_COOLDOWN_MS;
}
