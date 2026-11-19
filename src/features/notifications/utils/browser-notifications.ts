export type BrowserNotificationPermissionState =
  | 'granted'
  | 'default'
  | 'denied'
  | 'unsupported';

export interface BrowserNotificationAdapter {
  getPermission(): BrowserNotificationPermissionState;
  requestPermission(): Promise<BrowserNotificationPermissionState>;
  showNotification(title: string, body: string): boolean;
}

export interface BrowserNotificationConstructor {
  readonly permission?: string;
  requestPermission?: () => Promise<string> | string;
  new (title: string, options?: { body?: string }): unknown;
}

export interface BrowserNotificationGlobal {
  Notification?: BrowserNotificationConstructor;
}

function normalizePermissionState(rawPermission: unknown): BrowserNotificationPermissionState {
  if (rawPermission === 'granted' || rawPermission === 'default' || rawPermission === 'denied') {
    return rawPermission;
  }
  return 'unsupported';
}

export function createBrowserNotificationAdapter(
  targetGlobal: BrowserNotificationGlobal = globalThis as unknown as BrowserNotificationGlobal,
): BrowserNotificationAdapter {
  return {
    getPermission(): BrowserNotificationPermissionState {
      try {
        const NotificationCtor = targetGlobal.Notification;
        if (!NotificationCtor) {
          return 'unsupported';
        }
        return normalizePermissionState(NotificationCtor.permission);
      } catch {
        return 'unsupported';
      }
    },

    async requestPermission(): Promise<BrowserNotificationPermissionState> {
      try {
        const NotificationCtor = targetGlobal.Notification;
        if (!NotificationCtor || typeof NotificationCtor.requestPermission !== 'function') {
          return this.getPermission();
        }
        const result = await NotificationCtor.requestPermission();
        const normalized = normalizePermissionState(result);
        return normalized === 'unsupported' ? this.getPermission() : normalized;
      } catch {
        return this.getPermission();
      }
    },

    showNotification(title: string, body: string): boolean {
      try {
        const NotificationCtor = targetGlobal.Notification;
        if (!NotificationCtor || this.getPermission() !== 'granted') {
          return false;
        }
        new NotificationCtor(title, { body });
        return true;
      } catch {
        return false;
      }
    },
  };
}
