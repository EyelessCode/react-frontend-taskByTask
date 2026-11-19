import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupsGridView } from '@/features/groups/components';
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
import { configureGroupsStore, resetGroupsStore } from '@/features/groups/store';
import { configureTasksStore, resetTasksStore } from '@/features/tasks/store';
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
import { LIMITS } from '@/shared/schemas';

describe('Notifications UI & Workspace Integration Flow (005-notifications, RF-27..RF-29)', () => {
  let adapter: LocalStorageAdapter;
  let notificationRepo: LocalStorageNotificationRepository;
  let notificationStateRepo: LocalStorageNotificationStateRepository;
  let groupRepo: LocalStorageGroupRepository;
  let taskRepo: LocalStorageTaskRepository;
  let tagRepo: LocalStorageTagRepository;
  let currentNowMs: number;
  let idCounter: number;
  let mockPermission: BrowserNotificationPermissionState;
  let dispatchedPopups: Array<{ title: string; body: string }>;
  let browserAdapter: BrowserNotificationAdapter;

  beforeEach(async () => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
    notificationRepo = new LocalStorageNotificationRepository(adapter);
    notificationStateRepo = new LocalStorageNotificationStateRepository(adapter);
    groupRepo = new LocalStorageGroupRepository(adapter);
    taskRepo = new LocalStorageTaskRepository(adapter);
    tagRepo = new LocalStorageTagRepository(adapter);

    // 2026-11-18 10:00:00 America/Bogota (UTC-5) = 15:00:00 UTC (>= 09:00 local)
    currentNowMs = Date.parse('2026-11-18T15:00:00.000Z');
    idCounter = 0;
    mockPermission = 'default';
    dispatchedPopups = [];

    browserAdapter = {
      getPermission: () => mockPermission,
      requestPermission: vi.fn(async () => Promise.resolve(mockPermission)),
      showNotification: vi.fn((title: string, body: string) => {
        if (mockPermission !== 'granted') {
          return false;
        }
        dispatchedPopups.push({ title, body });
        return true;
      }),
    };

    resetAuthStore();
    configureAuthStore({
      userRepository: new LocalStorageUserRepository(adapter),
      sessionRepository: new LocalStorageSessionRepository(adapter),
      recoveryCodeRepository: new LocalStorageRecoveryCodeRepository(adapter),
      loginLockoutRepository: new LocalStorageLoginLockoutRepository(adapter),
      notificationRepository: notificationRepo,
      notificationStateRepository: notificationStateRepo,
      groupRepository: groupRepo,
      taskRepository: taskRepo,
      tagRepository: tagRepo,
      now: () => currentNowMs,
      getTimeZone: () => 'America/Bogota',
    });

    resetNotificationsStore();
    configureNotificationsStore({
      notificationRepository: notificationRepo,
      notificationStateRepository: notificationStateRepo,
      taskRepository: taskRepo,
      groupRepository: groupRepo,
      getCurrentUser: () => useAuthStore.getState().currentUser,
      browserNotifications: browserAdapter,
      now: () => currentNowMs,
      createId: () => `ntf-${++idCounter}`,
    });

    resetGroupsStore();
    configureGroupsStore({
      groupRepository: groupRepo,
      taskRepository: taskRepo,
      tagRepository: tagRepo,
      getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
    });

    resetTasksStore();
    configureTasksStore({
      groupRepository: groupRepo,
      taskRepository: taskRepo,
      tagRepository: tagRepo,
      getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
    });

    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    useAuthStore.getState().acknowledgeRegistrationCodes();
  });

  afterEach(() => {
    resetNotificationsStore();
  });

  it('displays discrete permission banner with 8h per-user cooldown, supports Activar avisos grant, and renders denied/unsupported guidance in panel', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<GroupsGridView />);

    // Banner shown on workspace load when permission is 'default'
    const banner = await screen.findByRole('region', {
      name: es.notifications.permissionPromptTitle,
    });
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(es.notifications.permissionPromptBody)).toBeInTheDocument();

    // Dismissing via "Ahora no" hides banner immediately
    await user.click(
      within(banner).getByRole('button', { name: es.notifications.dismissReminderButton }),
    );
    expect(
      screen.queryByRole('region', { name: es.notifications.permissionPromptTitle }),
    ).not.toBeInTheDocument();

    // Even while banner is in 8h cooldown, opening Notification Center shows "Activar avisos"
    await user.click(
      screen.getByRole('button', { name: es.notifications.centerButtonAria(0) }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(es.notifications.permissionDefaultStatus)).toBeInTheDocument();
    expect(within(dialog).getByText(es.notifications.emptyState)).toBeInTheDocument();

    // Grant permission from inside Notification Center
    mockPermission = 'granted';
    await user.click(
      within(dialog).getByRole('button', { name: es.notifications.enableNotificationsButton }),
    );
    expect(
      await within(dialog).findByText(es.notifications.permissionGrantedStatus),
    ).toBeInTheDocument();

    // Close panel via Escape
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    unmount();

    // When permission is 'denied' and 8h have elapsed, banner & panel show blocked reactivation instructions without "Activar avisos"
    mockPermission = 'denied';
    currentNowMs += 8 * 3_600_000 + 1000;
    const deniedRender = render(<GroupsGridView />);
    const blockedBanner = await screen.findByRole('region', {
      name: es.notifications.permissionBlockedTitle,
    });
    expect(
      within(blockedBanner).getByText(es.notifications.permissionBlockedInstructions),
    ).toBeInTheDocument();
    expect(
      within(blockedBanner).queryByRole('button', {
        name: es.notifications.enableNotificationsButton,
      }),
    ).not.toBeInTheDocument();
    deniedRender.unmount();

    // When browser notifications are 'unsupported', no banner is shown and panel shows unsupported note
    mockPermission = 'unsupported';
    currentNowMs += 8 * 3_600_000 + 1000;
    render(<GroupsGridView />);
    expect(
      await screen.findByText(`${es.auth.greetingPrefix} Ana García`),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: es.notifications.permissionPromptTitle }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: es.notifications.centerButtonAria(0) }),
    );
    const unsupportedDialog = await screen.findByRole('dialog');
    expect(
      within(unsupportedDialog).getByText(es.notifications.permissionUnsupportedNote),
    ).toBeInTheDocument();
  });

  it('triggers immediate due alert for today date-only post-09:00, updates unread badge, formats 12h/24h timestamps, prunes >= 30d on open, and supports markAsRead, markAllAsRead, and delete', async () => {
    const user = userEvent.setup();
    mockPermission = 'granted';
    const userId = useAuthStore.getState().currentUser!.id;

    // Seed an expired 31-day-old notification and a recent unread notification
    const expiredIso = new Date(
      currentNowMs - (LIMITS.NOTIFICATION_RETENTION_DAYS + 1) * 86_400_000,
    ).toISOString();
    await notificationRepo.save({
      id: 'ntf-expired',
      userId,
      eventType: 'due_date',
      content: 'Alerta caducada hace 31 días',
      read: false,
      createdAt: expiredIso,
    });

    // Switch user preference to 12h to verify 12h formatting in Notification Center & alert message
    await useAuthStore.getState().updateProfile({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      timeFormat: '12h',
    });

    render(<GroupsGridView />);
    expect(
      await screen.findByText(`${es.auth.greetingPrefix} Ana García`),
    ).toBeInTheDocument();

    // Create a date-only task for today ('2026-11-18') while local time is 10:00 (>= 09:00)
    await user.click(screen.getByRole('button', { name: new RegExp(es.groups.addTaskToGroup) }));
    const taskModal = await screen.findByRole('dialog');
    await user.type(within(taskModal).getByLabelText(es.tasks.titleLabel), 'Entrega hoy');
    await user.type(within(taskModal).getByLabelText(es.tasks.dueDateLabel), '2026-11-18');
    await user.click(within(taskModal).getByRole('button', { name: es.common.save }));

    // Immediate alert fired! Header button aria-label updates to 1 unread
    const centerBtn = await screen.findByRole('button', {
      name: es.notifications.centerButtonAria(1),
    });
    expect(centerBtn).toBeInTheDocument();
    expect(dispatchedPopups).toEqual([
      {
        title: es.notifications.dueAlertTitle,
        body: 'La tarea "Entrega hoy" vence el 18/11/2026.',
      },
    ]);

    // Add a second notification directly so we can test both individual markAsRead and markAllAsRead
    await notificationRepo.save({
      id: 'ntf-second',
      userId,
      eventType: 'due_date',
      content: 'La tarea "Reunión tarde" vence el 18/11/2026 a las 02:30 p. m..',
      read: false,
      createdAt: '2026-11-18T15:05:00.000Z', // 10:05 a. m. Bogota
    });

    // Open Notification Center -> prunes >30d item and loads 2 unread items
    await user.click(centerBtn);
    const panel = await screen.findByRole('dialog');
    expect(
      within(panel).queryByText('Alerta caducada hace 31 días'),
    ).not.toBeInTheDocument();
    expect(
      within(panel).getByText('La tarea "Entrega hoy" vence el 18/11/2026.'),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(
        'La tarea "Reunión tarde" vence el 18/11/2026 a las 02:30 p. m..',
      ),
    ).toBeInTheDocument();

    // Verify 12h timestamp formatting in America/Bogota (15:00 UTC -> 18/11/2026, 10:00 a. m.)
    expect(within(panel).getByText('18/11/2026, 10:00 a. m.')).toBeInTheDocument();
    expect(within(panel).getByText('18/11/2026, 10:05 a. m.')).toBeInTheDocument();
    expect(within(panel).getAllByText(es.notifications.unreadBadge)).toHaveLength(2);

    // Mark first notification as read
    const markReadBtns = within(panel).getAllByRole('button', {
      name: es.notifications.markAsReadAria,
    });
    await user.click(markReadBtns[0]!);
    await waitFor(() => {
      expect(useNotificationsStore.getState().unreadCount).toBe(1);
    });
    expect(within(panel).getAllByText(es.notifications.unreadBadge)).toHaveLength(1);

    // Mark all remaining as read -> unreadCount becomes 0 and "Marcar todas como leídas" becomes disabled
    const markAllBtn = within(panel).getByRole('button', {
      name: es.notifications.markAllAsReadAria,
    });
    expect(markAllBtn).not.toBeDisabled();
    await user.click(markAllBtn);
    await waitFor(() => {
      expect(useNotificationsStore.getState().unreadCount).toBe(0);
    });
    expect(markAllBtn).toBeDisabled();
    expect(within(panel).queryByText(es.notifications.unreadBadge)).not.toBeInTheDocument();

    // Delete both notifications -> empty state appears
    const deleteBtns = within(panel).getAllByRole('button', {
      name: es.notifications.deleteAria,
    });
    await user.click(deleteBtns[0]!);
    await user.click(
      within(panel).getByRole('button', { name: es.notifications.deleteAria }),
    );
    expect(await within(panel).findByText(es.notifications.emptyState)).toBeInTheDocument();
  }, 15_000);
});
