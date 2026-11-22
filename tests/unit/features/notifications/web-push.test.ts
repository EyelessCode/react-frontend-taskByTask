import { describe, expect, it, vi } from 'vitest';
import {
  createWebPushAdapter,
  extractPushSubscriptionPayload,
  parsePushNotificationPayload,
  urlBase64ToUint8Array,
} from '@/features/notifications/utils';
import { es } from '@/shared/i18n';

describe('Web Push utilities & WebPushAdapter (T9)', () => {
  describe('urlBase64ToUint8Array', () => {
    it('decodes unpadded Base64URL VAPID keys into Uint8Array bytes', () => {
      // 'Hello' in base64url is 'SGVsbG8'
      const bytes = urlBase64ToUint8Array('SGVsbG8');
      expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);

      // URL-safe chars '-' and '_' ('?>?' -> 'Pz4_' -> [63, 62, 63])
      const urlSafe = urlBase64ToUint8Array('Pz4_');
      expect(Array.from(urlSafe)).toEqual([63, 62, 63]);
    });

    it('throws on empty or malformed Base64URL input', () => {
      expect(() => urlBase64ToUint8Array('')).toThrow();
      expect(() => urlBase64ToUint8Array('   ')).toThrow();
      expect(() => urlBase64ToUint8Array('invalid*chars!')).toThrow();
    });
  });

  describe('extractPushSubscriptionPayload', () => {
    it('extracts endpoint and p256dh/auth keys from PushSubscription.toJSON()', () => {
      const payload = extractPushSubscriptionPayload({
        endpoint: 'https://push.example/sub-1',
        toJSON: () => ({
          endpoint: 'https://push.example/sub-1',
          keys: {
            p256dh: 'p256dh-key',
            auth: 'auth-key',
          },
        }),
      });

      expect(payload).toEqual({
        endpoint: 'https://push.example/sub-1',
        keys: {
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
      });
    });

    it('returns null when endpoint or keys are missing', () => {
      expect(extractPushSubscriptionPayload(null)).toBeNull();
      expect(
        extractPushSubscriptionPayload({
          endpoint: 'https://push.example/sub-1',
          toJSON: () => ({ endpoint: 'https://push.example/sub-1', keys: {} }),
        }),
      ).toBeNull();
    });
  });

  describe('parsePushNotificationPayload', () => {
    it('parses valid JSON payload with title, body/content/message, and safe relative url', () => {
      expect(
        parsePushNotificationPayload(
          JSON.stringify({
            title: 'Aviso urgente',
            body: 'Tu tarea vence hoy',
            url: '/?group=1',
          }),
        ),
      ).toEqual({
        title: 'Aviso urgente',
        body: 'Tu tarea vence hoy',
        url: '/?group=1',
      });

      expect(
        parsePushNotificationPayload(
          JSON.stringify({
            content: 'Desde content',
            url: '/profile',
          }),
        ),
      ).toEqual({
        title: es.notifications.pushFallbackTitle,
        body: 'Desde content',
        url: '/profile',
      });

      expect(
        parsePushNotificationPayload(
          JSON.stringify({
            message: 'Desde message',
          }),
        ),
      ).toEqual({
        title: es.notifications.pushFallbackTitle,
        body: 'Desde message',
        url: '/',
      });
    });

    it('handles plain text, empty payloads, malformed JSON, and rejects unsafe URLs', () => {
      expect(parsePushNotificationPayload('Recordatorio en texto plano')).toEqual({
        title: es.notifications.pushFallbackTitle,
        body: 'Recordatorio en texto plano',
        url: '/',
      });

      expect(parsePushNotificationPayload('')).toEqual({
        title: es.notifications.pushFallbackTitle,
        body: es.notifications.pushFallbackBody,
        url: '/',
      });
      expect(parsePushNotificationPayload(null)).toEqual({
        title: es.notifications.pushFallbackTitle,
        body: es.notifications.pushFallbackBody,
        url: '/',
      });

      expect(parsePushNotificationPayload('{malformed-json')).toEqual({
        title: es.notifications.pushFallbackTitle,
        body: es.notifications.pushFallbackBody,
        url: '/',
      });

      expect(
        parsePushNotificationPayload(
          JSON.stringify({
            title: 'Test',
            body: 'Body',
            url: 'https://evil.example/phish',
          }),
        ).url,
      ).toBe('/');
      expect(
        parsePushNotificationPayload(
          JSON.stringify({
            title: 'Test',
            body: 'Body',
            url: '//evil.example/phish',
          }),
        ).url,
      ).toBe('/');
      expect(
        parsePushNotificationPayload(
          JSON.stringify({
            title: 'Test',
            body: 'Body',
            url: 'javascript:alert(1)',
          }),
        ).url,
      ).toBe('/');
    });
  });

  describe('WebPushAdapter', () => {
    it('returns unsupported when ServiceWorker, PushManager, or Notification is missing', async () => {
      const adapter = createWebPushAdapter({ navigator: {} });
      expect(adapter.isSupported()).toBe(false);
      expect(await adapter.subscribe('SGVsbG8')).toBeNull();
      expect(await adapter.getActiveEndpoint()).toBeNull();
      expect(await adapter.unsubscribeLocal()).toBe(false);
    });

    it('registers /sw.js, subscribes with VAPID key, reads endpoint, and unsubscribes safely', async () => {
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const mockSubscription = {
        endpoint: 'https://push.example/endpoint-1',
        toJSON: () => ({
          endpoint: 'https://push.example/endpoint-1',
          keys: { p256dh: 'p256dh-val', auth: 'auth-val' },
        }),
        unsubscribe: mockUnsubscribe,
      };
      const mockPushManager = {
        getSubscription: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue(mockSubscription),
        subscribe: vi.fn().mockResolvedValue(mockSubscription),
      };
      const mockRegistration = { pushManager: mockPushManager };
      const mockRegister = vi.fn().mockResolvedValue(mockRegistration);
      const mockGetRegistration = vi.fn().mockResolvedValue(mockRegistration);

      const adapter = createWebPushAdapter({
        Notification: {} as never,
        PushManager: function PushManager() {} as never,
        navigator: {
          serviceWorker: {
            register: mockRegister,
            getRegistration: mockGetRegistration,
          },
        },
      });

      expect(adapter.isSupported()).toBe(true);

      const subPayload = await adapter.subscribe('SGVsbG8');
      expect(mockRegister).toHaveBeenCalledWith('/sw.js');
      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });
      expect(subPayload).toEqual({
        endpoint: 'https://push.example/endpoint-1',
        keys: { p256dh: 'p256dh-val', auth: 'auth-val' },
      });

      expect(await adapter.getActiveEndpoint()).toBe('https://push.example/endpoint-1');
      expect(await adapter.unsubscribeLocal()).toBe(true);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('handles ServiceWorker registration or unsubscribe errors without throwing', async () => {
      const adapter = createWebPushAdapter({
        Notification: {} as never,
        PushManager: function PushManager() {} as never,
        navigator: {
          serviceWorker: {
            register: vi.fn().mockRejectedValue(new Error('SW rejected')),
            getRegistration: vi.fn().mockRejectedValue(new Error('getReg failed')),
          },
        },
      });

      expect(adapter.isSupported()).toBe(true);
      expect(await adapter.subscribe('SGVsbG8')).toBeNull();
      expect(await adapter.getActiveEndpoint()).toBeNull();
      expect(await adapter.unsubscribeLocal()).toBe(false);
    });
  });
});
