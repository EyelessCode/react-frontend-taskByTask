import type { RegisterPushSubscriptionApiInput } from '../../../data/contracts';
import { es } from '../../../shared/i18n';

export interface ParsedPushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushSubscriptionLike {
  endpoint?: string;
  toJSON?: () => {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  unsubscribe?: () => Promise<boolean>;
}

export interface PushManagerLike {
  getSubscription: () => Promise<PushSubscriptionLike | null>;
  subscribe: (options: {
    userVisibleOnly: boolean;
    applicationServerKey: BufferSource;
  }) => Promise<PushSubscriptionLike>;
}

export interface ServiceWorkerRegistrationLike {
  pushManager?: PushManagerLike;
}

export interface ServiceWorkerContainerLike {
  register: (scriptURL: string) => Promise<ServiceWorkerRegistrationLike>;
  getRegistration?: (scope?: string) => Promise<ServiceWorkerRegistrationLike | undefined>;
}

export interface WebPushGlobal {
  Notification?: unknown;
  PushManager?: unknown;
  navigator?: {
    serviceWorker?: ServiceWorkerContainerLike;
  };
}

export interface WebPushAdapter {
  isSupported(): boolean;
  subscribe(vapidPublicKey: string): Promise<RegisterPushSubscriptionApiInput | null>;
  getActiveEndpoint(): Promise<string | null>;
  unsubscribeLocal(): Promise<boolean>;
}

const SERVICE_WORKER_PATH = '/sw.js';

function isSafeRelativeUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !/[\r\n]/.test(trimmed)
  );
}

/**
 * Decodes a Base64URL-encoded VAPID public key into a Uint8Array suitable for PushManager.subscribe.
 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const trimmed = base64Url.trim();
  if (!trimmed || !/^[A-Za-z0-9_-]+=*$/.test(trimmed)) {
    throw new Error('Invalid Base64URL VAPID key');
  }

  const paddingLength = (4 - (trimmed.length % 4)) % 4;
  const base64 = `${trimmed}${'='.repeat(paddingLength)}`.replace(/-/g, '+').replace(/_/g, '/');

  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extracts `{ endpoint, keys: { p256dh, auth } }` from a browser PushSubscription.
 */
export function extractPushSubscriptionPayload(
  subscription: PushSubscriptionLike | null | undefined,
): RegisterPushSubscriptionApiInput | null {
  if (!subscription) {
    return null;
  }

  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : undefined;
  const endpoint = json?.endpoint ?? subscription.endpoint;
  const p256dh = json?.keys?.p256dh;
  const auth = json?.keys?.auth;

  if (
    typeof endpoint !== 'string' ||
    !endpoint.trim() ||
    typeof p256dh !== 'string' ||
    !p256dh.trim() ||
    typeof auth !== 'string' ||
    !auth.trim()
  ) {
    return null;
  }

  return {
    endpoint: endpoint.trim(),
    keys: {
      p256dh: p256dh.trim(),
      auth: auth.trim(),
    },
  };
}

/**
 * Parses push notification payloads identically to `public/sw.js` with Spanish fallbacks
 * and strict same-origin relative URL validation.
 */
export function parsePushNotificationPayload(rawText: string | null | undefined): ParsedPushPayload {
  const fallbackTitle = es.notifications.pushFallbackTitle;
  const fallbackBody = es.notifications.pushFallbackBody;
  const trimmed = typeof rawText === 'string' ? rawText.trim() : '';

  if (!trimmed) {
    return { title: fallbackTitle, body: fallbackBody, url: '/' };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const title =
        typeof record.title === 'string' && record.title.trim().length > 0
          ? record.title.trim()
          : fallbackTitle;
      const bodyCandidate = [record.body, record.content, record.message].find(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.trim().length > 0,
      );
      const body = bodyCandidate ? bodyCandidate.trim() : fallbackBody;
      const url = isSafeRelativeUrl(record.url) ? record.url.trim() : '/';
      return { title, body, url };
    }
  } catch {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { title: fallbackTitle, body: fallbackBody, url: '/' };
    }
  }

  return { title: fallbackTitle, body: trimmed, url: '/' };
}

export function createWebPushAdapter(
  targetGlobal: WebPushGlobal = globalThis as unknown as WebPushGlobal,
): WebPushAdapter {
  const isSupported = (): boolean => {
    try {
      return Boolean(
        targetGlobal.navigator?.serviceWorker &&
          typeof targetGlobal.navigator.serviceWorker.register === 'function' &&
          targetGlobal.PushManager &&
          targetGlobal.Notification,
      );
    } catch {
      return false;
    }
  };

  const getExistingSubscription = async (): Promise<PushSubscriptionLike | null> => {
    if (!isSupported()) {
      return null;
    }
    try {
      const sw = targetGlobal.navigator?.serviceWorker;
      const registration =
        typeof sw?.getRegistration === 'function'
          ? await sw.getRegistration()
          : undefined;
      if (!registration?.pushManager) {
        return null;
      }
      return await registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  };

  return {
    isSupported,

    async subscribe(vapidPublicKey: string): Promise<RegisterPushSubscriptionApiInput | null> {
      if (!isSupported()) {
        return null;
      }
      try {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        const registration = await targetGlobal.navigator!.serviceWorker!.register(
          SERVICE_WORKER_PATH,
        );
        if (!registration.pushManager) {
          return null;
        }
        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }));
        return extractPushSubscriptionPayload(subscription);
      } catch {
        return null;
      }
    },

    async getActiveEndpoint(): Promise<string | null> {
      const subscription = await getExistingSubscription();
      const payload = extractPushSubscriptionPayload(subscription);
      return payload?.endpoint ?? null;
    },

    async unsubscribeLocal(): Promise<boolean> {
      const subscription = await getExistingSubscription();
      if (!subscription || typeof subscription.unsubscribe !== 'function') {
        return false;
      }
      try {
        return await subscription.unsubscribe();
      } catch {
        return false;
      }
    },
  };
}
