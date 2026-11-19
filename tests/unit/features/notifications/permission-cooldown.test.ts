import { describe, expect, it, vi } from 'vitest';
import {
  PERMISSION_COOLDOWN_MS,
  createBrowserNotificationAdapter,
  isPermissionBannerDue,
} from '@/features/notifications/utils';

describe('Permission Cooldown & BrowserNotificationAdapter (005-notifications, RF-27)', () => {
  const baseNowMs = Date.parse('2026-11-18T12:00:00.000Z');

  describe('isPermissionBannerDue (REQ-NT-02)', () => {
    it('returns false when permission is granted or unsupported regardless of lastShownAt', () => {
      expect(isPermissionBannerDue('granted', null, baseNowMs)).toBe(false);
      expect(isPermissionBannerDue('unsupported', null, baseNowMs)).toBe(false);
      expect(
        isPermissionBannerDue(
          'granted',
          new Date(baseNowMs - PERMISSION_COOLDOWN_MS - 1000).toISOString(),
          baseNowMs,
        ),
      ).toBe(false);
    });

    it('returns true for default or denied when lastShownAt is null or corrupted ISO', () => {
      expect(isPermissionBannerDue('default', null, baseNowMs)).toBe(true);
      expect(isPermissionBannerDue('denied', null, baseNowMs)).toBe(true);
      expect(isPermissionBannerDue('default', 'invalid-timestamp', baseNowMs)).toBe(true);
    });

    it('enforces exact 8-hour (28,800,000 ms) cooldown window for default and denied states', () => {
      const justUnder8h = new Date(baseNowMs - PERMISSION_COOLDOWN_MS + 1).toISOString();
      const exact8h = new Date(baseNowMs - PERMISSION_COOLDOWN_MS).toISOString();
      const over8h = new Date(baseNowMs - PERMISSION_COOLDOWN_MS - 60_000).toISOString();

      expect(isPermissionBannerDue('default', justUnder8h, baseNowMs)).toBe(false);
      expect(isPermissionBannerDue('denied', justUnder8h, baseNowMs)).toBe(false);

      expect(isPermissionBannerDue('default', exact8h, baseNowMs)).toBe(true);
      expect(isPermissionBannerDue('denied', exact8h, baseNowMs)).toBe(true);

      expect(isPermissionBannerDue('default', over8h, baseNowMs)).toBe(true);
      expect(isPermissionBannerDue('denied', over8h, baseNowMs)).toBe(true);
    });
  });

  describe('createBrowserNotificationAdapter (REQ-NT-01, REQ-NT-03..05, REQ-NT-11)', () => {
    it('degrades cleanly to unsupported when Notification API is missing', async () => {
      const adapter = createBrowserNotificationAdapter({});
      expect(adapter.getPermission()).toBe('unsupported');
      expect(await adapter.requestPermission()).toBe('unsupported');
      expect(adapter.showNotification('Título', 'Mensaje')).toBe(false);
    });

    it('reads permission, requests permission, and dispatches native Notification when granted', async () => {
      const constructed: Array<{ title: string; body?: string }> = [];
      let currentPermission = 'default';

      class FakeNotification {
        static get permission() {
          return currentPermission;
        }
        static async requestPermission() {
          currentPermission = 'granted';
          return Promise.resolve('granted');
        }
        constructor(title: string, options?: { body?: string }) {
          constructed.push({ title, body: options?.body });
        }
      }

      const adapter = createBrowserNotificationAdapter({
        Notification: FakeNotification,
      });

      expect(adapter.getPermission()).toBe('default');
      // Cannot show popup while still 'default'
      expect(adapter.showNotification('Aviso', 'Cuerpo')).toBe(false);
      expect(constructed).toHaveLength(0);

      const nextPerm = await adapter.requestPermission();
      expect(nextPerm).toBe('granted');
      expect(adapter.getPermission()).toBe('granted');

      expect(adapter.showNotification('Aviso de vencimiento', 'La tarea vence hoy.')).toBe(true);
      expect(constructed).toEqual([
        { title: 'Aviso de vencimiento', body: 'La tarea vence hoy.' },
      ]);
    });

    it('catches exceptions thrown by requestPermission or constructor without crashing', async () => {
      const requestPermissionSpy = vi.fn(() => {
        throw new Error('Blocked by browser policy');
      });

      class ThrowingNotification {
        static permission = 'granted';
        static requestPermission = requestPermissionSpy;
        constructor() {
          throw new Error('Mobile WebView constructor illegal invocation');
        }
      }

      const adapter = createBrowserNotificationAdapter({
        Notification: ThrowingNotification,
      });

      expect(await adapter.requestPermission()).toBe('granted');
      expect(adapter.showNotification('Aviso', 'Mensaje')).toBe(false);
    });
  });
});
