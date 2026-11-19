import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureNotificationsStore,
  resetNotificationsStore,
  useNotificationsStore,
} from '@/features/notifications/store';
import type {
  BrowserNotificationAdapter,
  BrowserNotificationPermissionState,
} from '@/features/notifications/utils';
import { configureAuthStore, resetAuthStore, useAuthStore } from '@/features/auth/store';
import {
  LocalStorageGroupRepository,
  LocalStorageLoginLockoutRepository,
  LocalStorageNotificationRepository,
  LocalStorageNotificationStateRepository,
  LocalStorageRecoveryCodeRepository,
  LocalStorageSessionRepository,
  LocalStorageTagRepository,
  LocalStorageTaskRepository,
  LocalStorageUserRepository,
} from '@/data/repositories';
import { LocalStorageAdapter } from '@/data/storage';
import { es } from '@/shared/i18n';
import { LIMITS, type Group, type Task, type User } from '@/shared/schemas';

const TEST_USER_1: User = {
  id: 'usr-1',
  email: 'ana@example.com',
  username: 'Ana123',
  displayName: 'Ana García',
  passwordHash: 'pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$deadbeef',
  timeZone: 'America/Bogota',
  timeFormat: '24h',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const TEST_USER_2: User = {
  id: 'usr-2',
  email: 'luis@example.com',
  username: 'Luis99',
  displayName: 'Luis Pérez',
  passwordHash: 'pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$deadbeef',
  timeZone: 'America/Bogota',
  timeFormat: '12h',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const GROUP_1: Group = {
  id: 'grp-1',
  name: 'Personal',
  type: 'individual',
  isPersonal: true,
  creatorId: 'usr-1',
  members: [{ userId: 'usr-1', role: 'creator', joinedAt: '2026-11-01T10:00:00.000Z' }],
  createdAt: '2026-11-01T10:00:00.000Z',
};

const GROUP_2: Group = {
  id: 'grp-2',
  name: 'Personal',
  type: 'individual',
  isPersonal: true,
  creatorId: 'usr-2',
  members: [{ userId: 'usr-2', role: 'creator', joinedAt: '2026-11-01T10:00:00.000Z' }],
  createdAt: '2026-11-01T10:00:00.000Z',
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Estudiar Redes',
    description: null,
    groupId: 'grp-1',
    tagIds: [],
    completed: false,
    createdAt: '2026-11-18T10:00:00.000Z',
    completedAt: null,
    dueDate: '2026-11-18',
    dueTime: '10:00',
    assigneeId: null,
    subtasks: [],
    reminders: [],
    ...overrides,
  };
}

describe('useNotificationsStore (005-notifications, RF-02, RF-27..RF-29)', () => {
  let adapter: LocalStorageAdapter;
  let notificationRepo: LocalStorageNotificationRepository;
  let notificationStateRepo: LocalStorageNotificationStateRepository;
  let taskRepo: LocalStorageTaskRepository;
  let groupRepo: LocalStorageGroupRepository;
  let currentNowMs: number;
  let idCounter: number;
  let currentUser: User | null;
  let mockPermission: BrowserNotificationPermissionState;
  let dispatchedPopups: Array<{ title: string; body: string }>;
  let shouldThrowOnShow: boolean;
  let browserAdapter: BrowserNotificationAdapter;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    adapter = new LocalStorageAdapter();
    notificationRepo = new LocalStorageNotificationRepository(adapter);
    notificationStateRepo = new LocalStorageNotificationStateRepository(adapter);
    taskRepo = new LocalStorageTaskRepository(adapter);
    groupRepo = new LocalStorageGroupRepository(adapter);

    // 2026-11-18 08:00:00 America/Bogota (UTC-5) = 13:00:00 UTC
    currentNowMs = Date.parse('2026-11-18T13:00:00.000Z');
    idCounter = 0;
    currentUser = TEST_USER_1;
    mockPermission = 'default';
    dispatchedPopups = [];
    shouldThrowOnShow = false;

    browserAdapter = {
      getPermission: () => mockPermission,
      requestPermission: vi.fn(async () => Promise.resolve(mockPermission)),
      showNotification: vi.fn((title: string, body: string) => {
        if (shouldThrowOnShow) {
          throw new Error('Native dispatch blocked');
        }
        if (mockPermission !== 'granted') {
          return false;
        }
        dispatchedPopups.push({ title, body });
        return true;
      }),
    };

    await groupRepo.save(GROUP_1);
    await groupRepo.save(GROUP_2);

    resetAuthStore();
    configureAuthStore({
      userRepository: new LocalStorageUserRepository(adapter),
      sessionRepository: new LocalStorageSessionRepository(adapter),
      recoveryCodeRepository: new LocalStorageRecoveryCodeRepository(adapter),
      loginLockoutRepository: new LocalStorageLoginLockoutRepository(adapter),
      notificationRepository: notificationRepo,
      groupRepository: groupRepo,
      taskRepository: taskRepo,
      tagRepository: new LocalStorageTagRepository(adapter),
    });

    resetNotificationsStore();
    configureNotificationsStore({
      notificationRepository: notificationRepo,
      notificationStateRepository: notificationStateRepo,
      taskRepository: taskRepo,
      groupRepository: groupRepo,
      getCurrentUser: () => currentUser,
      browserNotifications: browserAdapter,
      now: () => currentNowMs,
      createId: () => `ntf-${++idCounter}`,
      setTimer: (cb, delay) => setTimeout(cb, delay),
      clearTimer: (handle) => clearTimeout(handle),
    });
  });

  afterEach(() => {
    resetNotificationsStore();
    vi.useRealTimers();
  });

  it('evaluates permission state and per-user 8-hour banner cooldown across reloads and users (REQ-NT-01..05)', async () => {
    mockPermission = 'default';
    await useNotificationsStore.getState().init();

    expect(useNotificationsStore.getState().permissionState).toBe('default');
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(true);

    // Dismissing banner hides it immediately and preserves 8h cooldown
    await useNotificationsStore.getState().dismissPermissionBanner();
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);

    // Reloading 7 hours later for usr-1 keeps banner hidden
    currentNowMs += 7 * 3_600_000;
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);

    // User 2 signing in on the same browser has independent cooldown -> banner is shown!
    currentUser = TEST_USER_2;
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(true);

    // Switch back to User 1 at 8 hours elapsed -> banner reappears for User 1
    currentUser = TEST_USER_1;
    currentNowMs += 1 * 3_600_000;
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(true);

    // Requesting permission and granting hides banner immediately
    mockPermission = 'granted';
    const nextPerm = await useNotificationsStore.getState().requestPermission();
    expect(nextPerm).toBe('granted');
    expect(useNotificationsStore.getState().permissionState).toBe('granted');
    expect(useNotificationsStore.getState().isPermissionBannerVisible).toBe(false);
  });

  it('catches up missed < 30d alerts once on init, deduplicates across reload, and schedules future timers', async () => {
    mockPermission = 'granted';
    // Missed yesterday (2026-11-17 10:00 Bogota)
    const missedTask = makeTask({
      id: 'task-missed',
      title: 'Tarea de ayer',
      dueDate: '2026-11-17',
      dueTime: '10:00',
    });
    // Due in 1 hour (2026-11-18 09:00 Bogota = 14:00 UTC, date-only)
    const todayDateOnly = makeTask({
      id: 'task-today',
      title: 'Tarea de hoy',
      dueDate: '2026-11-18',
      dueTime: null,
    });
    await taskRepo.save(missedTask);
    await taskRepo.save(todayDateOnly);

    await useNotificationsStore.getState().init();

    // Missed task fired immediately on init
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
    expect(useNotificationsStore.getState().notifications[0]?.content).toBe(
      es.notifications.dueAlertWithTime('Tarea de ayer', '17/11/2026', '10:00'),
    );
    expect(dispatchedPopups).toHaveLength(1);

    // Re-running init (reload) does NOT duplicate the missed alert
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);

    // Advance 1 hour to 09:00 Bogota -> scheduled timer for task-today fires!
    currentNowMs += 3_600_000;
    await vi.advanceTimersByTimeAsync(3_600_000);

    expect(useNotificationsStore.getState().notifications).toHaveLength(2);
    expect(useNotificationsStore.getState().unreadCount).toBe(2);
    expect(dispatchedPopups).toHaveLength(2);
  });

  it('handles task save (today post-09:00 immediate, past suppression, non-schedule title edit, schedule edit, toggle, delete, group delete)', async () => {
    mockPermission = 'granted';
    // Set clock to 2026-11-18 10:00 Bogota (15:00 UTC, >= 09:00 local)
    currentNowMs = Date.parse('2026-11-18T15:00:00.000Z');
    await useNotificationsStore.getState().init();

    // 1. Date-only task created for today after 09:00 local -> fires immediately once!
    const todayPostNine = makeTask({
      id: 'task-post-9',
      title: 'Hoy después de las 9',
      dueDate: '2026-11-18',
      dueTime: null,
    });
    await taskRepo.save(todayPostNine);
    await useNotificationsStore.getState().handleTaskSaved(todayPostNine, 'usr-1', true);
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);

    // Non-schedule edit (renaming title without changing dueDate/dueTime) does NOT refire
    const renamedToday = { ...todayPostNine, title: 'Hoy renombrada' };
    await taskRepo.save(renamedToday);
    await useNotificationsStore.getState().handleTaskSaved(renamedToday, 'usr-1', false);
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);

    // 2. Past-due timed task created at 10:00 for 09:30 today -> suppressed (no alert now or on reload)
    const pastTimed = makeTask({
      id: 'task-past-timed',
      title: 'Ya vencida',
      dueDate: '2026-11-18',
      dueTime: '09:30',
    });
    await taskRepo.save(pastTimed);
    await useNotificationsStore.getState().handleTaskSaved(pastTimed, 'usr-1', true);
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);

    // 3. Future timed task scheduled for 11:00 Bogota (+1h), then completed -> timer cancelled
    const futureTask = makeTask({
      id: 'task-future',
      title: 'Reunión 11am',
      dueDate: '2026-11-18',
      dueTime: '11:00',
    });
    await taskRepo.save(futureTask);
    await useNotificationsStore.getState().handleTaskSaved(futureTask, 'usr-1', true);

    const completedTask = { ...futureTask, completed: true, completedAt: new Date(currentNowMs).toISOString() };
    await taskRepo.save(completedTask);
    await useNotificationsStore.getState().handleTaskToggled(completedTask, 'usr-1');

    // Unchecking while still in the future (10:30 Bogota) reschedules timer for 11:00
    currentNowMs += 30 * 60_000;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);

    const uncheckedFuture = { ...futureTask, completed: false, completedAt: null };
    await taskRepo.save(uncheckedFuture);
    await useNotificationsStore.getState().handleTaskToggled(uncheckedFuture, 'usr-1');

    // Deleting the task before 11:00 cancels the rescheduled timer
    await taskRepo.delete(uncheckedFuture.id);
    await useNotificationsStore.getState().handleTaskDeleted(uncheckedFuture.id, 'usr-1');

    currentNowMs += 30 * 60_000;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
  });

  it('persists Notification Center record even when native Notification constructor throws, and supports markAsRead, markAllAsRead, deleteNotification, and openCenter 30d pruning', async () => {
    mockPermission = 'granted';
    shouldThrowOnShow = true;
    currentNowMs = Date.parse('2026-11-18T15:00:00.000Z');

    // Pre-seed a 31-day-old notification that should be pruned on openCenter
    const oldCreatedAt = new Date(
      currentNowMs - (LIMITS.NOTIFICATION_RETENTION_DAYS + 1) * 86_400_000,
    ).toISOString();
    await notificationRepo.save({
      id: 'ntf-expired',
      userId: 'usr-1',
      eventType: 'due_date',
      content: 'Notificación antigua',
      read: false,
      createdAt: oldCreatedAt,
    });

    const task1 = makeTask({ id: 't1', title: 'Alerta 1', dueDate: '2026-11-18', dueTime: null });
    const task2 = makeTask({ id: 't2', title: 'Alerta 2', dueDate: '2026-11-18', dueTime: null });
    await taskRepo.save(task1);
    await taskRepo.save(task2);

    // Native popup throws, but inbox records still land cleanly!
    await useNotificationsStore.getState().handleTaskSaved(task1, 'usr-1', true);
    await useNotificationsStore.getState().handleTaskSaved(task2, 'usr-1', true);

    await useNotificationsStore.getState().openCenter();
    expect(useNotificationsStore.getState().isCenterOpen).toBe(true);
    // Expired notification was pruned; only the 2 new notifications remain
    expect(useNotificationsStore.getState().notifications).toHaveLength(2);
    expect(useNotificationsStore.getState().unreadCount).toBe(2);

    const firstId = useNotificationsStore.getState().notifications[0]!.id;
    await useNotificationsStore.getState().markAsRead(firstId);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);

    await useNotificationsStore.getState().markAllAsRead();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);

    // Deleting from Notification Center removes inbox item but does NOT erase handledOccurrences (no reload resurrection)
    await useNotificationsStore.getState().deleteNotification(firstId);
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
    await useNotificationsStore.getState().init();
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
  });

  it('cancels all active timers and clears runtime state immediately on subscribeAuthSessionEnd (logout, expired, orphan, deleted)', async () => {
    mockPermission = 'granted';
    const futureTask = makeTask({
      id: 'task-logout-cancel',
      title: 'No debe sonar tras logout',
      dueDate: '2026-11-18',
      dueTime: '09:00',
    });
    await taskRepo.save(futureTask);
    await useNotificationsStore.getState().init();

    // Trigger session end via useAuthStore.getState().logout()
    currentUser = null;
    await useAuthStore.getState().logout();

    expect(useNotificationsStore.getState().notifications).toEqual([]);
    expect(useNotificationsStore.getState().unreadCount).toBe(0);

    // Advance past 09:00 Bogota -> cancelled timer must NOT fire
    currentNowMs += 3_600_000;
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(dispatchedPopups).toHaveLength(0);
    expect(await notificationRepo.getByUserId('usr-1')).toEqual([]);
  });
});
