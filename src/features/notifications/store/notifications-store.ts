import { create } from 'zustand';
import { getApiServices } from '../../../data/api';
import type {
  GroupRepository,
  NotificationRepository,
  NotificationsApiRepository,
  NotificationStateRepository,
  TaskRepository,
} from '../../../data/contracts';
import {
  LocalStorageGroupRepository,
  LocalStorageNotificationRepository,
  LocalStorageNotificationStateRepository,
  LocalStorageTaskRepository,
} from '../../../data/repositories';
import { getPersistenceConfig, type PersistenceMode } from '../../../shared/config';
import {
  ApiProblemError,
  NetworkError,
  RateLimitError,
  UnauthorizedError,
} from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import {
  LIMITS,
  type HandledDueOccurrence,
  type HandledDueOccurrenceStatus,
  type Notification,
  type Task,
  type User,
  type UserNotificationState,
} from '../../../shared/schemas';
import { subscribeAuthSessionEnd, useAuthStore } from '../../auth/store';
import {
  buildOccurrenceKey,
  classifyDueTaskAlert,
  createBrowserNotificationAdapter,
  createWebPushAdapter,
  formatDueAlertContent,
  isPermissionBannerDue,
  isTaskDueAlertRecipient,
  scheduleCappedTimeout,
  type BrowserNotificationAdapter,
  type BrowserNotificationPermissionState,
  type ClearTimerFn,
  type DueAlertEvaluationMode,
  type SetTimerFn,
  type WebPushAdapter,
} from '../utils';

export type PushStatus =
  | 'idle'
  | 'enabled'
  | 'disabled-by-server'
  | 'unavailable'
  | 'unsupported'
  | 'subscription-error';

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  permissionState: BrowserNotificationPermissionState;
  isPermissionBannerVisible: boolean;
  isCenterOpen: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNext: boolean;
  nextCursor: string | null;
  pushStatus: PushStatus;
  vapidPublicKey: string | null;
  error: string | null;
}

export interface NotificationsActions {
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  openCenter: () => Promise<void>;
  closeCenter: () => void;
  loadMoreNotifications: () => Promise<void>;
  requestPermission: () => Promise<BrowserNotificationPermissionState>;
  dismissPermissionBanner: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  handleTaskSaved: (task: Task, userId: string, scheduleChanged: boolean) => Promise<void>;
  handleTaskToggled: (task: Task, userId: string) => Promise<void>;
  handleTaskDeleted: (taskId: string, userId: string) => Promise<void>;
  handleTasksDeleted: (taskIds: string[], userId: string) => Promise<void>;
  clearActiveRuntime: () => void;
}

export type NotificationsStore = NotificationsState & NotificationsActions;

export interface NotificationsStoreDependencies {
  mode?: PersistenceMode;
  notificationsApi?: NotificationsApiRepository;
  webPush: WebPushAdapter;
  notificationRepository: NotificationRepository;
  notificationStateRepository: NotificationStateRepository;
  taskRepository: TaskRepository;
  groupRepository: GroupRepository;
  getCurrentUser: () => User | null;
  browserNotifications: BrowserNotificationAdapter;
  now: () => number;
  createId: () => string;
  setTimer: SetTimerFn;
  clearTimer: ClearTimerFn;
}

function defaultCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultDependencies(): NotificationsStoreDependencies {
  return {
    webPush: createWebPushAdapter(),
    notificationRepository: new LocalStorageNotificationRepository(),
    notificationStateRepository: new LocalStorageNotificationStateRepository(),
    taskRepository: new LocalStorageTaskRepository(),
    groupRepository: new LocalStorageGroupRepository(),
    getCurrentUser: () => useAuthStore.getState().currentUser,
    browserNotifications: createBrowserNotificationAdapter(),
    now: () => Date.now(),
    createId: defaultCreateId,
    setTimer: (cb, delay) => setTimeout(cb, delay),
    clearTimer: (handle) => clearTimeout(handle),
  };
}

let deps: NotificationsStoreDependencies = createDefaultDependencies();

export function configureNotificationsStore(
  overrides: Partial<NotificationsStoreDependencies>,
): void {
  deps = { ...createDefaultDependencies(), ...overrides };
}

export function isNotificationsStoreApiMode(): boolean {
  return (deps.mode ?? getPersistenceConfig().mode) === 'api';
}

function resolveNotificationsApi(): NotificationsApiRepository {
  return deps.notificationsApi ?? getApiServices().notificationsApi;
}

function resolveApiErrorMessage(err: unknown): string {
  if (err instanceof ApiProblemError) {
    return err.detail?.trim() || err.message;
  }
  if (
    err instanceof RateLimitError ||
    err instanceof NetworkError ||
    err instanceof UnauthorizedError ||
    err instanceof Error
  ) {
    return err.message;
  }
  return es.errors.unexpected;
}

function mergeNotificationsById(
  existing: readonly Notification[],
  incoming: readonly Notification[],
): Notification[] {
  const map = new Map<string, Notification>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  permissionState: 'default',
  isPermissionBannerVisible: false,
  isCenterOpen: false,
  isLoading: false,
  isLoadingMore: false,
  hasNext: false,
  nextCursor: null,
  pushStatus: 'idle',
  vapidPublicKey: null,
  error: null,
};

/**
 * Module-scoped map of active per-task due-alert timer cleanup callbacks.
 * Kept outside serializable Zustand state (plan.md Section 3.2).
 */
const activeTaskTimers = new Map<string, () => void>();

function cancelTaskTimer(taskId: string): void {
  const cancel = activeTaskTimers.get(taskId);
  if (cancel) {
    activeTaskTimers.delete(taskId);
    cancel();
  }
}

function cancelAllTaskTimers(): void {
  for (const cancel of activeTaskTimers.values()) {
    cancel();
  }
  activeTaskTimers.clear();
}

/**
 * Serialized promise queue for read-modify-write operations on `tbt:v1:notification_state`
 * so concurrent timer fires or catch-up alerts never overwrite each other (plan.md Section 3.2).
 */
let stateMutationQueue: Promise<void> = Promise.resolve();

function enqueueStateUpdate(
  userId: string,
  updater: (
    current: UserNotificationState,
  ) => UserNotificationState | Promise<UserNotificationState>,
): Promise<UserNotificationState> {
  const resultPromise = stateMutationQueue.then(async () => {
    const current = await deps.notificationStateRepository.getByUserId(userId);
    const next = await updater(current);
    await deps.notificationStateRepository.save(next);
    return next;
  });
  stateMutationQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );
  return resultPromise;
}

function upsertOccurrenceInList(
  list: HandledDueOccurrence[],
  entry: HandledDueOccurrence,
): HandledDueOccurrence[] {
  const filtered = list.filter((item) => item.taskId !== entry.taskId);
  filtered.push(entry);
  return filtered;
}

async function recordHandledOccurrence(
  userId: string,
  taskId: string,
  occurrenceKey: string,
  status: HandledDueOccurrenceStatus,
  recordedAt: string,
): Promise<UserNotificationState> {
  return enqueueStateUpdate(userId, (current) => ({
    ...current,
    handledOccurrences: upsertOccurrenceInList(current.handledOccurrences, {
      taskId,
      occurrenceKey,
      status,
      recordedAt,
    }),
  }));
}

async function removeTaskOccurrences(
  userId: string,
  taskIds: Set<string>,
): Promise<UserNotificationState> {
  return enqueueStateUpdate(userId, (current) => ({
    ...current,
    handledOccurrences: current.handledOccurrences.filter(
      (item) => !taskIds.has(item.taskId),
    ),
  }));
}

async function refreshUserNotificationsInState(
  userId: string,
  set: (partial: Partial<NotificationsState>) => void,
): Promise<Notification[]> {
  const list = await deps.notificationRepository.getByUserId(userId);
  const unreadCount = list.filter((item) => !item.read).length;
  set({
    notifications: list,
    unreadCount,
  });
  return list;
}

async function deliverDueAlert(
  task: Task,
  user: User,
  occurrenceKey: string,
  set: (partial: Partial<NotificationsState>) => void,
): Promise<void> {
  const activeUser = deps.getCurrentUser();
  if (!activeUser || activeUser.id !== user.id) {
    return;
  }

  cancelTaskTimer(task.id);
  const nowIso = new Date(deps.now()).toISOString();

  let alreadyNotified = false;
  await enqueueStateUpdate(user.id, (current) => {
    const existing = current.handledOccurrences.find(
      (item) =>
        item.taskId === task.id &&
        item.occurrenceKey === occurrenceKey &&
        item.status === 'notified',
    );
    if (existing) {
      alreadyNotified = true;
      return current;
    }
    return {
      ...current,
      handledOccurrences: upsertOccurrenceInList(current.handledOccurrences, {
        taskId: task.id,
        occurrenceKey,
        status: 'notified',
        recordedAt: nowIso,
      }),
    };
  });

  if (alreadyNotified) {
    return;
  }

  const content = formatDueAlertContent(task, activeUser.timeFormat);
  const notification: Notification = {
    id: deps.createId(),
    userId: user.id,
    eventType: 'due_date',
    content,
    read: false,
    createdAt: nowIso,
  };

  await deps.notificationRepository.save(notification);
  await refreshUserNotificationsInState(user.id, set);

  try {
    if (deps.browserNotifications.getPermission() === 'granted') {
      deps.browserNotifications.showNotification(es.notifications.dueAlertTitle, content);
    }
  } catch {
    // Best-effort browser notification dispatch; guaranteed Notification Center entry is already saved.
  }
}

async function handleScheduledTimerFired(
  taskId: string,
  userId: string,
  expectedOccurrenceKey: string,
  set: (partial: Partial<NotificationsState>) => void,
): Promise<void> {
  activeTaskTimers.delete(taskId);
  const currentUser = deps.getCurrentUser();
  if (!currentUser || currentUser.id !== userId) {
    return;
  }

  const latestTask = await deps.taskRepository.getById(taskId);
  if (!latestTask || latestTask.completed || !latestTask.dueDate) {
    return;
  }

  const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(userId);
  const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));
  if (!isTaskDueAlertRecipient(latestTask, accessibleGroupIds, userId)) {
    return;
  }

  const currentOccurrenceKey = buildOccurrenceKey(latestTask.dueDate, latestTask.dueTime);
  if (currentOccurrenceKey !== expectedOccurrenceKey) {
    return;
  }

  await deliverDueAlert(latestTask, currentUser, expectedOccurrenceKey, set);
}

async function evaluateAndApplyTaskSchedule(
  task: Task,
  user: User,
  accessibleGroupIds: Set<string>,
  mode: DueAlertEvaluationMode,
  set: (partial: Partial<NotificationsState>) => void,
): Promise<void> {
  cancelTaskTimer(task.id);

  const userState = await deps.notificationStateRepository.getByUserId(user.id);
  const isEligible = isTaskDueAlertRecipient(task, accessibleGroupIds, user.id);
  const nowMs = deps.now();
  const nowIso = new Date(nowMs).toISOString();

  const decision = classifyDueTaskAlert({
    task,
    timeZone: user.timeZone,
    nowMs,
    mode,
    handledOccurrences: userState.handledOccurrences,
    isEligibleRecipient: isEligible,
  });

  if (decision.action === 'none' || decision.action === 'already-handled') {
    return;
  }

  if (decision.action === 'suppress') {
    await recordHandledOccurrence(
      user.id,
      task.id,
      decision.occurrenceKey,
      'suppressed',
      nowIso,
    );
    return;
  }

  if (decision.action === 'trigger-now') {
    await deliverDueAlert(task, user, decision.occurrenceKey, set);
    return;
  }

  // decision.action === 'schedule'
  const cancel = scheduleCappedTimeout(
    decision.triggerAtMs,
    deps.now,
    () => {
      void handleScheduledTimerFired(task.id, user.id, decision.occurrenceKey, set);
    },
    deps.setTimer,
    deps.clearTimer,
  );
  activeTaskTimers.set(task.id, cancel);
}

async function syncWorkspaceTasksForUser(
  user: User,
  set: (partial: Partial<NotificationsState>) => void,
): Promise<void> {
  cancelAllTaskTimers();

  const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(user.id);
  const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));
  const allTasks = await deps.taskRepository.getAll();
  const userTasks = allTasks.filter((task) => accessibleGroupIds.has(task.groupId));

  for (const task of userTasks) {
    await evaluateAndApplyTaskSchedule(task, user, accessibleGroupIds, 'sync', set);
  }
}

async function subscribeAndRegisterWebPush(vapidPublicKey: string): Promise<PushStatus> {
  if (!deps.webPush.isSupported()) {
    return 'unsupported';
  }
  try {
    const subscription = await deps.webPush.subscribe(vapidPublicKey);
    if (!subscription) {
      return 'subscription-error';
    }
    await resolveNotificationsApi().registerPushSubscription(subscription);
    return 'enabled';
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    return 'subscription-error';
  }
}

async function discoverAndSyncWebPush(
  user: User,
  nowMs: number,
  nowIso: string,
  evaluateBannerCooldown: boolean,
): Promise<{
  pushStatus: PushStatus;
  vapidPublicKey: string | null;
  permissionState: BrowserNotificationPermissionState;
  isPermissionBannerVisible: boolean;
}> {
  const permission = deps.browserNotifications.getPermission();

  let vapid: { enabled: boolean; publicKey: string | null };
  try {
    vapid = await resolveNotificationsApi().getVapidPublicKey();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    return {
      pushStatus: 'unavailable',
      vapidPublicKey: null,
      permissionState: permission,
      isPermissionBannerVisible: false,
    };
  }

  const publicKey = vapid.publicKey?.trim() || null;
  if (!vapid.enabled || !publicKey) {
    return {
      pushStatus: 'disabled-by-server',
      vapidPublicKey: null,
      permissionState: permission,
      isPermissionBannerVisible: false,
    };
  }

  if (!deps.webPush.isSupported() || permission === 'unsupported') {
    return {
      pushStatus: 'unsupported',
      vapidPublicKey: publicKey,
      permissionState: permission,
      isPermissionBannerVisible: false,
    };
  }

  if (permission === 'granted') {
    const status = await subscribeAndRegisterWebPush(publicKey);
    return {
      pushStatus: status,
      vapidPublicKey: publicKey,
      permissionState: permission,
      isPermissionBannerVisible: false,
    };
  }

  let bannerDue = false;
  if (evaluateBannerCooldown) {
    const userState = await deps.notificationStateRepository.getByUserId(user.id);
    bannerDue = isPermissionBannerDue(
      permission,
      userState.permissionPromptLastShownAt,
      nowMs,
    );
    if (bannerDue) {
      await enqueueStateUpdate(user.id, (current) => ({
        ...current,
        permissionPromptLastShownAt: nowIso,
      }));
    }
  }

  return {
    pushStatus: 'enabled',
    vapidPublicKey: publicKey,
    permissionState: permission,
    isPermissionBannerVisible: bannerDue,
  };
}

export const useNotificationsStore = create<NotificationsStore>()((set, get) => ({
  ...initialState,

  init: async () => {
    const user = deps.getCurrentUser();
    if (!user) {
      get().clearActiveRuntime();
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const nowMs = deps.now();
      const nowIso = new Date(nowMs).toISOString();

      if (isNotificationsStoreApiMode()) {
        cancelAllTaskTimers();
        const [unreadCount, pushInfo] = await Promise.all([
          resolveNotificationsApi().getUnreadCount(),
          discoverAndSyncWebPush(user, nowMs, nowIso, true),
        ]);

        set({
          unreadCount,
          permissionState: pushInfo.permissionState,
          isPermissionBannerVisible: pushInfo.isPermissionBannerVisible,
          pushStatus: pushInfo.pushStatus,
          vapidPublicKey: pushInfo.vapidPublicKey,
          isLoading: false,
        });
        return;
      }

      await deps.notificationRepository.pruneExpired(user.id, nowIso);

      const permission = deps.browserNotifications.getPermission();
      const userState = await deps.notificationStateRepository.getByUserId(user.id);
      const bannerDue = isPermissionBannerDue(
        permission,
        userState.permissionPromptLastShownAt,
        nowMs,
      );

      if (bannerDue) {
        await enqueueStateUpdate(user.id, (current) => ({
          ...current,
          permissionPromptLastShownAt: nowIso,
        }));
      }

      await syncWorkspaceTasksForUser(user, set);
      const list = await deps.notificationRepository.getByUserId(user.id);

      set({
        notifications: list,
        unreadCount: list.filter((n) => !n.read).length,
        permissionState: permission,
        isPermissionBannerVisible: bannerDue,
        isLoading: false,
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        set({ isLoading: false });
        return;
      }
      set({ error: resolveApiErrorMessage(err), isLoading: false });
    }
  },

  refresh: async () => {
    const user = deps.getCurrentUser();
    if (!user) {
      get().clearActiveRuntime();
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const nowMs = deps.now();
      const nowIso = new Date(nowMs).toISOString();

      if (isNotificationsStoreApiMode()) {
        cancelAllTaskTimers();
        const api = resolveNotificationsApi();
        const currentState = get();

        const unreadPromise = api.getUnreadCount();
        const pagePromise = currentState.isCenterOpen
          ? api.listNotifications(user.id, { limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT })
          : Promise.resolve(null);

        const [unreadCount, page] = await Promise.all([unreadPromise, pagePromise]);

        let pushPatch: Partial<NotificationsState> = {};
        if (currentState.pushStatus === 'unavailable' || currentState.pushStatus === 'idle') {
          const pushInfo = await discoverAndSyncWebPush(user, nowMs, nowIso, false);
          pushPatch = {
            pushStatus: pushInfo.pushStatus,
            vapidPublicKey: pushInfo.vapidPublicKey,
            permissionState: pushInfo.permissionState,
            isPermissionBannerVisible: pushInfo.isPermissionBannerVisible,
          };
        } else {
          const permission = deps.browserNotifications.getPermission();
          const keepBanner =
            currentState.pushStatus === 'enabled' &&
            currentState.isPermissionBannerVisible &&
            (permission === 'default' || permission === 'denied');
          pushPatch = {
            permissionState: permission,
            isPermissionBannerVisible: keepBanner,
          };
          if (
            currentState.pushStatus === 'enabled' &&
            currentState.vapidPublicKey &&
            permission === 'granted'
          ) {
            pushPatch.pushStatus = await subscribeAndRegisterWebPush(currentState.vapidPublicKey);
          }
        }

        set({
          unreadCount,
          ...(page
            ? {
                notifications: page.content,
                nextCursor: page.nextCursor,
                hasNext: page.hasNext,
                isLoadingMore: false,
              }
            : {}),
          ...pushPatch,
          isLoading: false,
        });
        return;
      }

      await deps.notificationRepository.pruneExpired(user.id, nowIso);
      await syncWorkspaceTasksForUser(user, set);

      const permission = deps.browserNotifications.getPermission();
      const list = await deps.notificationRepository.getByUserId(user.id);
      const keepBanner =
        get().isPermissionBannerVisible &&
        (permission === 'default' || permission === 'denied');

      set({
        notifications: list,
        unreadCount: list.filter((n) => !n.read).length,
        permissionState: permission,
        isPermissionBannerVisible: keepBanner,
        isLoading: false,
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        set({ isLoading: false });
        return;
      }
      set({ error: resolveApiErrorMessage(err), isLoading: false });
    }
  },

  openCenter: async () => {
    const user = deps.getCurrentUser();
    const permission = deps.browserNotifications.getPermission();
    set({ isCenterOpen: true, permissionState: permission });
    if (!user) {
      return;
    }

    if (isNotificationsStoreApiMode()) {
      set({ isLoading: true, error: null });
      try {
        const api = resolveNotificationsApi();
        const [page, unreadCount] = await Promise.all([
          api.listNotifications(user.id, { limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT }),
          api.getUnreadCount(),
        ]);
        set({
          notifications: page.content,
          nextCursor: page.nextCursor,
          hasNext: page.hasNext,
          isLoadingMore: false,
          unreadCount,
          isLoading: false,
        });
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          set({ isLoading: false });
          return;
        }
        set({ error: resolveApiErrorMessage(err), isLoading: false });
      }
      return;
    }

    const nowIso = new Date(deps.now()).toISOString();
    await deps.notificationRepository.pruneExpired(user.id, nowIso);
    await refreshUserNotificationsInState(user.id, set);
  },

  closeCenter: () => {
    set({ isCenterOpen: false });
  },

  loadMoreNotifications: async () => {
    if (!isNotificationsStoreApiMode()) {
      return;
    }
    const user = deps.getCurrentUser();
    const state = get();
    if (!user || !state.hasNext || !state.nextCursor || state.isLoadingMore) {
      return;
    }

    set({ isLoadingMore: true, error: null });
    try {
      const page = await resolveNotificationsApi().listNotifications(user.id, {
        cursor: state.nextCursor,
        limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      });
      set((prev) => ({
        notifications: mergeNotificationsById(prev.notifications, page.content),
        nextCursor: page.nextCursor,
        hasNext: page.hasNext,
        isLoadingMore: false,
      }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        set({ isLoadingMore: false });
        return;
      }
      set({ error: resolveApiErrorMessage(err), isLoadingMore: false });
    }
  },

  requestPermission: async () => {
    const nextPermission = await deps.browserNotifications.requestPermission();
    const user = deps.getCurrentUser();
    if (user) {
      const nowIso = new Date(deps.now()).toISOString();
      await enqueueStateUpdate(user.id, (current) => ({
        ...current,
        permissionPromptLastShownAt: nowIso,
      }));
    }

    if (nextPermission === 'granted' || nextPermission === 'unsupported') {
      set({
        permissionState: nextPermission,
        isPermissionBannerVisible: false,
      });
    } else {
      set({
        permissionState: nextPermission,
      });
    }

    if (isNotificationsStoreApiMode() && nextPermission === 'granted') {
      const { pushStatus, vapidPublicKey } = get();
      if (pushStatus === 'enabled' && vapidPublicKey) {
        try {
          const nextStatus = await subscribeAndRegisterWebPush(vapidPublicKey);
          set({ pushStatus: nextStatus });
        } catch (err) {
          if (!(err instanceof UnauthorizedError)) {
            set({ pushStatus: 'subscription-error' });
          }
        }
      }
    }

    return nextPermission;
  },

  dismissPermissionBanner: async () => {
    set({ isPermissionBannerVisible: false });
    const user = deps.getCurrentUser();
    if (user) {
      const nowIso = new Date(deps.now()).toISOString();
      await enqueueStateUpdate(user.id, (current) => ({
        ...current,
        permissionPromptLastShownAt: nowIso,
      }));
    }
  },

  markAsRead: async (notificationId: string) => {
    const user = deps.getCurrentUser();
    if (!user) {
      return;
    }

    if (isNotificationsStoreApiMode()) {
      try {
        const updated = await resolveNotificationsApi().markAsRead(notificationId, user.id);
        set((prev) => {
          const existing = prev.notifications.find((n) => n.id === notificationId);
          const wasUnread = existing ? !existing.read : false;
          return {
            notifications: prev.notifications.map((n) =>
              n.id === notificationId ? updated : n,
            ),
            unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
            error: null,
          };
        });
      } catch (err) {
        if (!(err instanceof UnauthorizedError)) {
          set({ error: resolveApiErrorMessage(err) });
        }
      }
      return;
    }

    await deps.notificationRepository.markAsRead(user.id, notificationId);
    await refreshUserNotificationsInState(user.id, set);
  },

  markAllAsRead: async () => {
    const user = deps.getCurrentUser();
    if (!user) {
      return;
    }

    if (isNotificationsStoreApiMode()) {
      try {
        await resolveNotificationsApi().markAllAsRead();
        set((prev) => ({
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
          error: null,
        }));
      } catch (err) {
        if (!(err instanceof UnauthorizedError)) {
          set({ error: resolveApiErrorMessage(err) });
        }
      }
      return;
    }

    await deps.notificationRepository.markAllAsRead(user.id);
    await refreshUserNotificationsInState(user.id, set);
  },

  deleteNotification: async (notificationId: string) => {
    const user = deps.getCurrentUser();
    if (!user) {
      return;
    }

    if (isNotificationsStoreApiMode()) {
      try {
        await resolveNotificationsApi().deleteNotification(notificationId);
        set((prev) => {
          const target = prev.notifications.find((n) => n.id === notificationId);
          const wasUnread = target ? !target.read : false;
          return {
            notifications: prev.notifications.filter((n) => n.id !== notificationId),
            unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
            error: null,
          };
        });
      } catch (err) {
        if (!(err instanceof UnauthorizedError)) {
          set({ error: resolveApiErrorMessage(err) });
        }
      }
      return;
    }

    await deps.notificationRepository.delete(user.id, notificationId);
    await refreshUserNotificationsInState(user.id, set);
  },

  handleTaskSaved: async (task: Task, userId: string, scheduleChanged: boolean) => {
    if (isNotificationsStoreApiMode()) {
      return;
    }
    const user = deps.getCurrentUser();
    if (!user || user.id !== userId) {
      return;
    }

    if (!scheduleChanged) {
      return;
    }

    cancelTaskTimer(task.id);
    await removeTaskOccurrences(user.id, new Set([task.id]));

    if (!task.dueDate || task.completed) {
      return;
    }

    const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(user.id);
    const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));
    await evaluateAndApplyTaskSchedule(task, user, accessibleGroupIds, 'save', set);
  },

  handleTaskToggled: async (task: Task, userId: string) => {
    if (isNotificationsStoreApiMode()) {
      return;
    }
    const user = deps.getCurrentUser();
    if (!user || user.id !== userId) {
      return;
    }

    cancelTaskTimer(task.id);
    if (task.completed || !task.dueDate) {
      return;
    }

    const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(user.id);
    const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));
    await evaluateAndApplyTaskSchedule(task, user, accessibleGroupIds, 'uncheck', set);
  },

  handleTaskDeleted: async (taskId: string, userId: string) => {
    if (isNotificationsStoreApiMode()) {
      return;
    }
    cancelTaskTimer(taskId);
    const user = deps.getCurrentUser();
    if (!user || user.id !== userId) {
      return;
    }
    await removeTaskOccurrences(user.id, new Set([taskId]));
  },

  handleTasksDeleted: async (taskIds: string[], userId: string) => {
    if (isNotificationsStoreApiMode()) {
      return;
    }
    for (const taskId of taskIds) {
      cancelTaskTimer(taskId);
    }
    const user = deps.getCurrentUser();
    if (!user || user.id !== userId || taskIds.length === 0) {
      return;
    }
    await removeTaskOccurrences(user.id, new Set(taskIds));
  },

  clearActiveRuntime: () => {
    cancelAllTaskTimers();
    set(initialState);
  },
}));

export function resetNotificationsStore(): void {
  cancelAllTaskTimers();
  stateMutationQueue = Promise.resolve();
  useNotificationsStore.setState(initialState);
}

subscribeAuthSessionEnd(() => {
  useNotificationsStore.getState().clearActiveRuntime();
});
