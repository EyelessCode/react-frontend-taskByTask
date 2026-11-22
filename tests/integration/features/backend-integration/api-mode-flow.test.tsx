import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createAppRouter } from '@/app/router';
import {
  configureApiServicesForTests,
  createApiServices,
  resetApiServicesForTests,
} from '@/data/api';
import { configureAuthStore, resetAuthStore, useAuthStore } from '@/features/auth/store';
import { resetGroupsStore } from '@/features/groups/store';
import { resetNotificationsStore } from '@/features/notifications/store';
import { resetTasksStore } from '@/features/tasks/store';
import {
  resetPersistenceConfigForTests,
  setPersistenceConfigForTests,
} from '@/shared/config';
import { es } from '@/shared/i18n';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problemResponse(
  status: number,
  detail: string,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Error',
      status,
      detail,
      ...extra,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  );
}

const BASE_USER_DTO = {
  id: 1,
  email: 'ana@example.com',
  username: 'Ana123',
  displayName: 'Ana García',
  timezone: 'America/Bogota',
  timeFormat: '24H',
  remainingRecoveryCodes: 6,
  createdAt: '2026-11-20T09:00:00Z',
};

const PERSONAL_GROUP_DTO = {
  id: 1,
  name: 'Personal',
  isPersonal: true,
  creatorId: 1,
  createdAt: '2026-11-20T09:00:00Z',
};

const WORK_GROUP_DTO = {
  id: 2,
  name: 'Trabajo',
  isPersonal: false,
  creatorId: 1,
  createdAt: '2026-11-20T09:05:00Z',
};

describe('Backend Integration API-Mode Flows (T10)', () => {
  beforeEach(() => {
    localStorage.clear();
    setPersistenceConfigForTests({ mode: 'api', apiBaseUrl: '' });
    resetAuthStore();
    resetGroupsStore();
    resetTasksStore();
    resetNotificationsStore();
  });

  afterEach(() => {
    resetApiServicesForTests();
    resetPersistenceConfigForTests();
    resetAuthStore();
    resetGroupsStore();
    resetTasksStore();
    resetNotificationsStore();
  });

  function renderAt(initialPath: string) {
    const history = createMemoryHistory({ initialEntries: [initialPath] });
    const router = createAppRouter(history);
    const utils = render(<RouterProvider router={router} />);
    return { router, history, ...utils };
  }

  it('handles cold-start 401 -> /login, login + CSRF + timezone, paginated groups/tasks, N+ counts, and Move modal Load More', async () => {
    const user = userEvent.setup();
    let authenticated = false;
    let movedToWork = false;
    const csrfHeadersSeen: Array<string | null> = [];
    const loginBodies: unknown[] = [];

    const fetchSpy = vi.fn<typeof fetch>(async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const path = parsedUrl.pathname;
      const cursor = parsedUrl.searchParams.get('cursor');
      const method = (init?.method ?? 'GET').toUpperCase();
      const headers = new Headers(init?.headers);

      if (path === '/api/v1/auth/csrf' && method === 'GET') {
        return jsonResponse({ token: 'csrf-tok-1', headerName: 'X-XSRF-TOKEN' });
      }
      if (path === '/api/v1/users/me' && method === 'GET') {
        if (!authenticated) {
          return problemResponse(401, 'No autenticado');
        }
        return jsonResponse(BASE_USER_DTO);
      }
      if (path === '/api/v1/auth/login' && method === 'POST') {
        csrfHeadersSeen.push(headers.get('X-XSRF-TOKEN'));
        loginBodies.push(JSON.parse(String(init?.body ?? '{}')));
        authenticated = true;
        return jsonResponse(BASE_USER_DTO);
      }
      if (path === '/api/v1/groups' && method === 'GET') {
        if (cursor === 'g-cur-1') {
          return jsonResponse({
            content: [WORK_GROUP_DTO],
            nextCursor: null,
            hasNext: false,
            size: 1,
          });
        }
        return jsonResponse({
          content: [PERSONAL_GROUP_DTO],
          nextCursor: 'g-cur-1',
          hasNext: true,
          size: 1,
        });
      }
      if (path === '/api/v1/groups/1/tasks' && method === 'GET') {
        if (cursor === 't-cur-1') {
          return jsonResponse({
            content: [
              {
                id: 102,
                title: 'Tarea página 2',
                description: null,
                groupId: 1,
                completed: false,
                dueDate: null,
                dueTime: null,
                overdue: false,
                assignedUserId: null,
                tags: [],
                createdAt: '2026-11-20T10:05:00Z',
                completedAt: null,
              },
            ],
            nextCursor: null,
            hasNext: false,
            size: 1,
          });
        }
        return jsonResponse({
          content: movedToWork
            ? []
            : [
                {
                  id: 101,
                  title: 'Tarea página 1',
                  description: null,
                  groupId: 1,
                  completed: false,
                  dueDate: '2026-11-01',
                  dueTime: null,
                  overdue: true,
                  assignedUserId: null,
                  tags: [],
                  createdAt: '2026-11-20T10:00:00Z',
                  completedAt: null,
                },
              ],
          nextCursor: 't-cur-1',
          hasNext: !movedToWork,
          size: movedToWork ? 0 : 1,
        });
      }
      if (path === '/api/v1/groups/2/tasks' && method === 'GET') {
        return jsonResponse({
          content: movedToWork
            ? [
                {
                  id: 101,
                  title: 'Tarea página 1',
                  description: null,
                  groupId: 2,
                  completed: false,
                  dueDate: '2026-11-01',
                  dueTime: null,
                  overdue: true,
                  assignedUserId: null,
                  tags: [],
                  createdAt: '2026-11-20T10:00:00Z',
                  completedAt: null,
                },
              ]
            : [],
          nextCursor: null,
          hasNext: false,
          size: movedToWork ? 1 : 0,
        });
      }
      if (path.endsWith('/tags') && method === 'GET') {
        return jsonResponse({ content: [], nextCursor: null, hasNext: false, size: 0 });
      }
      if (path === '/api/v1/tasks/101/move' && method === 'POST') {
        movedToWork = true;
        return jsonResponse({
          id: 101,
          title: 'Tarea página 1',
          description: null,
          groupId: 2,
          completed: false,
          dueDate: '2026-11-01',
          dueTime: null,
          overdue: true,
          assignedUserId: null,
          tags: [],
          createdAt: '2026-11-20T10:00:00Z',
          completedAt: null,
        });
      }
      if (path === '/api/v1/notifications/unread-count' && method === 'GET') {
        return jsonResponse({ unreadCount: 0 });
      }
      if (path === '/api/v1/notifications/push/vapid-public-key' && method === 'GET') {
        return jsonResponse({ enabled: false, publicKey: null });
      }
      return problemResponse(404, 'No encontrado');
    });

    configureApiServicesForTests(createApiServices({ fetchFn: fetchSpy }));
    configureAuthStore({ getTimeZone: () => 'America/Bogota' });

    const { router } = renderAt('/');

    // Cold-start 401 -> /login without sessionExpired notice
    expect(await screen.findByRole('heading', { name: es.auth.loginTitle })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(es.auth.sessionExpired)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.passwordLabel), 'Secret123');
    await user.click(screen.getByRole('button', { name: es.auth.loginButton }));

    expect(await screen.findByText('Tarea página 1')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(csrfHeadersSeen).toEqual(['csrf-tok-1']);
    expect(loginBodies[0]).toMatchObject({
      email: 'ana@example.com',
      timezone: 'America/Bogota',
    });

    // Active tab N+ count & card N+ badge
    expect(screen.getByRole('tab', { name: 'Pendientes (1+)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Completadas' })).toBeInTheDocument();
    expect(screen.getByText(es.groups.taskCountAtLeast(1))).toBeInTheDocument();

    // Load more tasks inside Personal card
    await user.click(screen.getByRole('button', { name: new RegExp(es.tasks.loadMoreTasks, 'i') }));
    expect(await screen.findByText('Tarea página 2')).toBeInTheDocument();
    expect(screen.getByText(es.groups.taskCount(2))).toBeInTheDocument();

    // Open Move modal while groupsHasNext is true -> noOtherGroups suppressed, load Trabajo inside modal
    const taskMenuButtons = screen.getAllByRole('button', { name: es.tasks.actionMenuAria });
    await user.click(taskMenuButtons[0]);
    await user.click(screen.getByRole('button', { name: es.tasks.actionMove }));

    expect(await screen.findByText(es.tasks.moveTitle)).toBeInTheDocument();
    expect(screen.queryByText(es.tasks.noOtherGroups)).not.toBeInTheDocument();

    const modalLoadMoreGroups = screen
      .getAllByRole('button', { name: es.groups.loadMoreGroups })
      .find((btn) => btn.closest('.modal') !== null);
    expect(modalLoadMoreGroups).toBeDefined();
    await user.click(modalLoadMoreGroups!);

    const moveModal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(moveModal).getByRole('option', { name: 'Trabajo' })).toBeInTheDocument();
    });
    await user.click(within(moveModal).getByRole('button', { name: es.tasks.confirmMove }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Trabajo' })).toBeInTheDocument();
    });
  });

  it('supports registration one-time codes, recovery normalization, and profile 12H + remainingRecoveryCodes', async () => {
    const user = userEvent.setup();
    const recoverBodies: unknown[] = [];
    const profilePatchBodies: unknown[] = [];
    let isLoggedIn = false;

    const fetchSpy = vi.fn<typeof fetch>(async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = new URL(rawUrl, 'http://localhost').pathname;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (path === '/api/v1/auth/csrf' && method === 'GET') {
        return jsonResponse({ token: 'csrf-tok-2', headerName: 'X-XSRF-TOKEN' });
      }
      if (path === '/api/v1/users/me' && method === 'GET') {
        if (!isLoggedIn) {
          return problemResponse(401, 'No autenticado');
        }
        return jsonResponse(BASE_USER_DTO);
      }
      if (path === '/api/v1/auth/register' && method === 'POST') {
        isLoggedIn = true;
        return jsonResponse(
          {
            user: { ...BASE_USER_DTO, remainingRecoveryCodes: 8 },
            recoveryCodes: [
              'A1B2-C3D4',
              'E5F6-G7H8',
              'J9K1-L2M3',
              'N4P5-Q6R7',
              'S8T9-U1V2',
              'W3X4-Y5Z6',
              'A7B8-C9D1',
              'E2F3-G4H5',
            ],
            recoveryCodesNotice: 'Guarda estos 8 códigos ahora mismo.',
          },
          201,
        );
      }
      if (path === '/api/v1/auth/recover-password' && method === 'POST') {
        recoverBodies.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse({ message: 'Contraseña restablecida.' });
      }
      if (path === '/api/v1/users/me' && method === 'PATCH') {
        profilePatchBodies.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse({ ...BASE_USER_DTO, timeFormat: '12H' });
      }
      if (path === '/api/v1/groups' && method === 'GET') {
        return jsonResponse({ content: [PERSONAL_GROUP_DTO], nextCursor: null, hasNext: false, size: 1 });
      }
      if (path === '/api/v1/groups/1/tasks' && method === 'GET') {
        return jsonResponse({ content: [], nextCursor: null, hasNext: false, size: 0 });
      }
      if (path.endsWith('/tags') && method === 'GET') {
        return jsonResponse({ content: [], nextCursor: null, hasNext: false, size: 0 });
      }
      if (path === '/api/v1/notifications/unread-count') {
        return jsonResponse({ unreadCount: 0 });
      }
      if (path === '/api/v1/notifications/push/vapid-public-key') {
        return jsonResponse({ enabled: false, publicKey: null });
      }
      return problemResponse(404, 'No encontrado');
    });

    configureApiServicesForTests(createApiServices({ fetchFn: fetchSpy }));

    // 1. Register -> 8 one-time codes & notice -> continue to workspace
    const { router, unmount } = renderAt('/register');
    expect(await screen.findByRole('heading', { name: es.auth.registerTitle })).toBeInTheDocument();

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.usernameLabel), 'Ana123');
    await user.type(screen.getByLabelText(es.auth.displayNameLabel), 'Ana García');
    await user.type(screen.getByLabelText(es.auth.passwordLabel), 'Secret123');
    await user.click(screen.getByRole('button', { name: es.auth.registerButton }));

    expect(await screen.findByText('Guarda estos 8 códigos ahora mismo.')).toBeInTheDocument();
    expect(screen.getByText('A1B2-C3D4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: es.auth.continueToApp }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    unmount();

    // 2. Profile -> remainingRecoveryCodes + 12H update
    resetAuthStore();
    useAuthStore.setState({
      currentUser: {
        id: '1',
        email: 'ana@example.com',
        username: 'Ana123',
        displayName: 'Ana García',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        remainingRecoveryCodes: 6,
        createdAt: '2026-11-20T09:00:00Z',
      },
      isAuthenticated: true,
      isInitialized: true,
    });
    const profileRender = renderAt('/profile');
    expect(await screen.findByText(es.auth.remainingRecoveryCodes(6))).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(es.auth.timeFormatLabel), '12h');
    await user.click(screen.getByRole('button', { name: es.auth.saveProfileButton }));

    expect(await screen.findByText(es.auth.profileSaved)).toBeInTheDocument();
    expect(profilePatchBodies[0]).toMatchObject({ timeFormat: '12H' });
    profileRender.unmount();

    // 3. Recover password with unhyphenated code normalized to XXXX-XXXX
    isLoggedIn = false;
    resetAuthStore();
    const recoverRender = renderAt('/recover');
    expect(await screen.findByRole('heading', { name: es.auth.recoverTitle })).toBeInTheDocument();
    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.recoveryCodeLabel), 'a1b2c3d4');
    await user.type(screen.getByLabelText(es.auth.newPasswordLabel), 'NewSecret123');
    await user.click(screen.getByRole('button', { name: es.auth.recoverButton }));

    expect(await screen.findByRole('heading', { name: es.auth.loginTitle })).toBeInTheDocument();
    expect(recoverBodies[0]).toMatchObject({ recoveryCode: 'A1B2-C3D4' });
    recoverRender.unmount();
  });

  it('renders Notification Center pagination, pushDisabledByServer & pushUnavailableStatus notices, suppresses banner, and handles mid-session 401 + logout with { endpoint }', async () => {
    const user = userEvent.setup();
    let vapidMode: 'disabled' | 'unavailable' = 'disabled';
    let sessionAlive = true;
    const logoutBodies: unknown[] = [];
    const unsubscribeSpy = vi.fn().mockResolvedValue(undefined);

    const fetchSpy = vi.fn<typeof fetch>(async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const path = parsedUrl.pathname;
      const cursor = parsedUrl.searchParams.get('cursor');
      const method = (init?.method ?? 'GET').toUpperCase();

      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-tok-3', headerName: 'X-XSRF-TOKEN' });
      }
      if (path === '/api/v1/users/me' && method === 'GET') {
        return sessionAlive
          ? jsonResponse(BASE_USER_DTO)
          : problemResponse(401, 'Sesión expirada');
      }
      if (path === '/api/v1/groups' && method === 'GET') {
        if (!sessionAlive) {
          return problemResponse(401, 'Sesión expirada');
        }
        return jsonResponse({ content: [PERSONAL_GROUP_DTO], nextCursor: null, hasNext: false, size: 1 });
      }
      if (path === '/api/v1/groups/1/tasks' && method === 'GET') {
        return jsonResponse({ content: [], nextCursor: null, hasNext: false, size: 0 });
      }
      if (path.endsWith('/tags') && method === 'GET') {
        return jsonResponse({ content: [], nextCursor: null, hasNext: false, size: 0 });
      }
      if (path === '/api/v1/notifications/unread-count' && method === 'GET') {
        return jsonResponse({ unreadCount: 1 });
      }
      if (path === '/api/v1/notifications/push/vapid-public-key' && method === 'GET') {
        if (vapidMode === 'disabled') {
          return jsonResponse({ enabled: false, publicKey: null });
        }
        return problemResponse(503, 'Servicio temporalmente no disponible');
      }
      if (path === '/api/v1/notifications' && method === 'GET') {
        if (cursor === 'n-cur-1') {
          return jsonResponse({
            content: [
              {
                id: 12,
                eventType: 'TASK_DUE',
                content: 'Notificación página 2',
                read: true,
                createdAt: '2026-11-20T12:00:00Z',
              },
            ],
            nextCursor: null,
            hasNext: false,
            size: 1,
          });
        }
        return jsonResponse({
          content: [
            {
              id: 11,
              eventType: 'TASK_DUE',
              content: 'Notificación página 1',
              read: false,
              createdAt: '2026-11-20T13:00:00Z',
            },
          ],
          nextCursor: 'n-cur-1',
          hasNext: true,
          size: 1,
        });
      }
      if (path === '/api/v1/auth/logout' && method === 'POST') {
        logoutBodies.push(JSON.parse(String(init?.body ?? '{}')));
        sessionAlive = false;
        return new Response(null, { status: 204 });
      }
      return problemResponse(404, 'No encontrado');
    });

    configureApiServicesForTests(createApiServices({ fetchFn: fetchSpy }));
    configureAuthStore({
      getPushEndpoint: async () => 'https://push.example/device-9',
      unsubscribeLocalPush: unsubscribeSpy,
    });

    // Part A: VAPID disabled-by-server + Notification Center Load More + explicit logout with { endpoint }
    const firstView = renderAt('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();
    expect(screen.queryByText(es.notifications.permissionPromptTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: es.notifications.centerButtonAria(1) }));
    expect(await screen.findByText(es.notifications.pushDisabledByServer)).toBeInTheDocument();
    expect(screen.getByText('Notificación página 1')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: es.notifications.loadMoreNotifications }),
    );
    expect(await screen.findByText('Notificación página 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: es.notifications.closeCenterAria }));
    await user.click(screen.getByRole('button', { name: es.auth.logoutButton }));

    expect(await screen.findByRole('heading', { name: es.auth.loginTitle })).toBeInTheDocument();
    expect(logoutBodies[0]).toEqual({ endpoint: 'https://push.example/device-9' });
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(es.auth.sessionExpired)).not.toBeInTheDocument();
    firstView.unmount();

    // Part B: VAPID unavailable (503) notice + mid-session 401 -> /login with sessionExpired
    sessionAlive = true;
    vapidMode = 'unavailable';
    resetAuthStore();
    resetGroupsStore();
    resetTasksStore();
    resetNotificationsStore();
    configureAuthStore({
      getPushEndpoint: async () => 'https://push.example/device-9',
      unsubscribeLocalPush: unsubscribeSpy,
    });

    const secondView = renderAt('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: es.notifications.centerButtonAria(1) }));
    expect(await screen.findByText(es.notifications.pushUnavailableStatus)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: es.notifications.closeCenterAria }));

    // Simulate session expiration mid-app, then click Refrescar
    sessionAlive = false;
    await user.click(screen.getByRole('button', { name: es.groups.refreshButton }));

    expect(await screen.findByRole('heading', { name: es.auth.loginTitle })).toBeInTheDocument();
    expect(screen.getByText(es.auth.sessionExpired)).toBeInTheDocument();
    secondView.unmount();
  });
});
