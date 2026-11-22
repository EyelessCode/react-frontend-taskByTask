import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationsApiRepository } from '@/data/contracts';
import {
  LocalStorageGroupRepository,
  LocalStorageNotificationRepository,
  LocalStorageNotificationStateRepository,
  LocalStorageTaskRepository,
} from '@/data/repositories';
import { LocalStorageAdapter } from '@/data/storage';
import {
  configureNotificationsStore,
  resetNotificationsStore,
  useNotificationsStore,
} from '@/features/notifications/store';
import type {
  BrowserNotificationAdapter,
  BrowserNotificationPermissionState,
  WebPushAdapter,
} from '@/features/notifications/utils';
import { ApiProblemError, NetworkError } from '@/shared/errors';
import type { Notification, Task, User } from '@/shared/schemas';

const API_USER: User = {
  id: '1',
  email: 'ana@example.com',
  username: 'Ana123',
  displayName: 'Ana García',
  timeZone: 'America/Bogota',
  timeFormat: '24h',
  createdAt: '2026-11-20T09:00:00Z',
};

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? '10',
    userId: overrides.userId ?? '1',
    eventType: overrides.eventType ?? 'TASK_DUE',
    content: overrides.content ?? 'La tarea "Informe" vence hoy.',
    read: overrides.read ?? false,
    createdAt: overrides.createdAt ?? '2026-11-20T14:00:00Z',
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? '100',
    title: overrides.title ?? 'Estudiar',
    description: null,
    groupId: overrides.groupId ?? '1',
    tagIds: [],
    completed: false,
    createdAt: '2026-11-20T10:00:00Z',
    completedAt: null,
    dueDate: '2026-11-20',
    dueTime: '14:00',
    assigneeId: null,
  };
}

describe('Dual-mode useNotificationsStore in API mode (T9)', () => {
  let notificationsApi: NotificationsApiRepository;
  let webPush: WebPushAdapter;
  let browserNotifications: BrowserNotificationAdapter;
  let permission: BrowserNotificationPermissionState;
  let setTimerSpy: ReturnType<typeof vi.fn>;
  let nowMs: number;

  beforeEach(() => {
    localStorage.clear();
    permission = 'default';
    nowMs = Date.parse('2026-11-20T14:00:00Z');
    setTimerSpy = vi.fn();

    notificationsApi = {
      listNotifications: vi.fn<NotificationsApiRepository['listNotifications']>(),
      getUnreadCount: vi.fn<NotificationsApiRepository['getUnreadCount']>(),
      markAsRead: vi.fn<NotificationsApiRepository['markAsRead']>(),
      markAllAsRead: vi.fn<NotificationsApiRepository['markAllAsRead']>(),
      deleteNotification: vi.fn<NotificationsApiRepository['deleteNotification']>(),
      getVapidPublicKey: vi.fn<NotificationsApiRepository['getVapidPublicKey']>(),
      registerPushSubscription:
        vi.fn<NotificationsApiRepository['registerPushSubscription']>(),
      deletePushSubscriptionByEndpoint:
        vi.fn<NotificationsApiRepository['deletePushSubscriptionByEndpoint']>(),
      deletePushSubscriptionById:
        vi.fn<NotificationsApiRepository['deletePushSubscriptionById']>(),
    };

    webPush = {
      isSupported: vi.fn(() => true),
      subscribe: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example/sub-1',
        keys: { p256dh: 'p256dh-1', auth: 'auth-1' },
      }),
      getActiveEndpoint: vi.fn().mockResolvedValue(null),
      unsubscribeLocal: vi.fn().mockResolvedValue(true),
    };

    browserNotifications = {
      getPermission: () => permission,
      requestPermission: vi.fn(async () => permission),
      showNotification: vi.fn(() => true),
    };

    const storageAdapter = new LocalStorageAdapter();
    configureNotificationsStore({
      mode: 'api',
      notificationsApi,
      webPush,
      notificationRepository: new LocalStorageNotificationRepository(storageAdapter),
      notificationStateRepository: new LocalStorageNotificationStateRepository(storageAdapter),
      taskRepository: new LocalStorageTaskRepository(storageAdapter),
      groupRepository: new LocalStorageGroupRepository(storageAdapter),
      getCurrentUser: () => API_USER,
      browserNotifications,
      now: () => nowMs,
      setTimer: setTimerSpy as never,
      clearTimer: vi.fn() as never,
    });
    resetNotificationsStore();
  });

  afterEach(() => {
    configureNotificationsStore({});
    resetNotificationsStore();
  });

  it('never schedules local due-alert timers on init or task mutations in API mode', async () => {
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValueOnce(2);
    vi.mocked(notificationsApi.getVapidPublicKey).mockResolvedValueOnce({
      enabled: true,
      publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFg',
    });

    await useNotificationsStore.getState().init();
    await useNotificationsStore.getState().handleTaskSaved(makeTask(), '1', true);
    await useNotificationsStore.getState().handleTaskToggled(makeTask(), '1');
    await useNotificationsStore.getState().handleTaskDeleted('100', '1');
    await useNotificationsStore.getState().handleTasksDeleted(['100'], '1');

    expect(setTimerSpy).not.toHaveBeenCalled();
    expect(browserNotifications.showNotification).not.toHaveBeenCalled();
    expect(useNotificationsStore.getState().unreadCount).toBe(2);
  });

  it('fetches unreadCount, paginates Notification Center via loadMoreNotifications, and handles read/read-all/delete', async () => {
    const n1 = makeNotification({ id: '10', read: false, content: 'Primera' });
    const n2 = makeNotification({ id: '11', read: true, content: 'Segunda' });
    const n3 = makeNotification({ id: '12', read: false, content: 'Tercera' });

    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(2);
    vi.mocked(notificationsApi.listNotifications)
      .mockResolvedValueOnce({
        content: [n1, n2],
        nextCursor: 'ntf-cur-1',
        hasNext: true,
        size: 2,
      })
      .mockResolvedValueOnce({
        content: [n3],
        nextCursor: null,
        hasNext: false,
        size: 1,
      });

    await useNotificationsStore.getState().openCenter();
    let state = useNotificationsStore.getState();
    expect(state.notifications.map((n) => n.id)).toEqual(['10', '11']);
    expect(state.hasNext).toBe(true);
    expect(state.nextCursor).toBe('ntf-cur-1');
    expect(state.unreadCount).toBe(2);

    await useNotificationsStore.getState().loadMoreNotifications();
    state = useNotificationsStore.getState();
    expect(notificationsApi.listNotifications).toHaveBeenLastCalledWith('1', {
      cursor: 'ntf-cur-1',
      limit: 20,
    });
    expect(state.notifications.map((n) => n.id)).toEqual(['10', '11', '12']);
    expect(state.hasNext).toBe(false);

    vi.mocked(notificationsApi.markAsRead).mockResolvedValueOnce({ ...n1, read: true });
    await useNotificationsStore.getState().markAsRead('10');
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
    expect(useNotificationsStore.getState().notifications.find((n) => n.id === '10')?.read).toBe(
      true,
    );

    vi.mocked(notificationsApi.deleteNotification).mockResolvedValueOnce(undefined);
    await useNotificationsStore.getState().deleteNotification('12');
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
    expect(useNotificationsStore.getState().notifications.some((n) => n.id === '12')).toBe(false);

    useNotificationsStore.setState({ unreadCount: 1 });
    vi.mocked(notificationsApi.markAllAsRead).mockResolvedValueOnce(1);
    await useNotificationsStore.getState().markAllAsRead();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
    expect(useNotificationsStore.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it('registers Web Push when VAPID enabled & permission already granted or newly granted', async () => {
    permission = 'granted';
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(0);
    vi.mocked(notificationsApi.getVapidPublicKey).mockResolvedValue({
      enabled: true,
      publicKey: 'VAPID_PUB_KEY',
    });
    vi.mocked(notificationsApi.registerPushSubscription).mockResolvedValue({
      id: '99',
      endpoint: 'https://push.example/sub-1',
      createdAt: '2026-11-20T14:00:00Z',
    });

    await useNotificationsStore.getState().init();
    expect(webPush.subscribe).toHaveBeenCalledWith('VAPID_PUB_KEY');
    expect(notificationsApi.registerPushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example/sub-1',
      keys: { p256dh: 'p256dh-1', auth: 'auth-1' },
    });
    expect(useNotificationsStore.getState().pushStatus).toBe('enabled');
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);

    // Now test newly granted via requestPermission()
    resetNotificationsStore();
    permission = 'default';
    vi.mocked(webPush.subscribe).mockClear();
    vi.mocked(notificationsApi.registerPushSubscription).mockClear();
    vi.mocked(browserNotifications.requestPermission).mockImplementationOnce(async () => {
      permission = 'granted';
      return 'granted';
    });

    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(true);

    const nextPerm = await useNotificationsStore.getState().requestPermission();
    expect(nextPerm).toBe('granted');
    expect(webPush.subscribe).toHaveBeenCalledWith('VAPID_PUB_KEY');
    expect(notificationsApi.registerPushSubscription).toHaveBeenCalledTimes(1);
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);
  });

  it('sets disabled-by-server when VAPID enabled=false and suppresses permission banner', async () => {
    permission = 'default';
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValueOnce(1);
    vi.mocked(notificationsApi.getVapidPublicKey).mockResolvedValueOnce({
      enabled: false,
      publicKey: null,
    });

    await useNotificationsStore.getState().init();

    const state = useNotificationsStore.getState();
    expect(state.pushStatus).toBe('disabled-by-server');
    expect(state.isPermissionBannerVisible).toBe(false);
    expect(webPush.subscribe).not.toHaveBeenCalled();
  });

  it('sets unavailable on VAPID 5xx/network failure, suppresses banner, and retries on refresh', async () => {
    permission = 'granted';
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(0);
    vi.mocked(notificationsApi.getVapidPublicKey)
      .mockRejectedValueOnce(new NetworkError('Sin conexión'))
      .mockResolvedValueOnce({
        enabled: true,
        publicKey: 'VAPID_RETRY_KEY',
      });
    vi.mocked(notificationsApi.registerPushSubscription).mockResolvedValueOnce({
      id: '100',
      endpoint: 'https://push.example/sub-1',
      createdAt: '2026-11-20T14:05:00Z',
    });

    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().pushStatus).toBe('unavailable');
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);

    await useNotificationsStore.getState().refresh();
    expect(notificationsApi.getVapidPublicKey).toHaveBeenCalledTimes(2);
    expect(webPush.subscribe).toHaveBeenCalledWith('VAPID_RETRY_KEY');
    expect(useNotificationsStore.getState().pushStatus).toBe('enabled');
  });

  it('degrades gracefully to unsupported or subscription-error without throwing', async () => {
    permission = 'granted';
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(0);
    vi.mocked(notificationsApi.getVapidPublicKey).mockResolvedValue({
      enabled: true,
      publicKey: 'VAPID_KEY',
    });

    vi.mocked(webPush.isSupported).mockReturnValueOnce(false);
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().pushStatus).toBe('unsupported');
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);

    vi.mocked(webPush.isSupported).mockReturnValue(true);
    vi.mocked(webPush.subscribe).mockRejectedValueOnce(
      new ApiProblemError('Error', { status: 500 }),
    );
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().pushStatus).toBe('subscription-error');
  });
});
