import { describe, expect, it, vi } from 'vitest';
import {
  ApiHttpClient,
  HttpAuthApiClient,
  HttpGroupsApiRepository,
  HttpNotificationsApiRepository,
  HttpTagsApiRepository,
  HttpTasksApiRepository,
  configureApiServicesForTests,
  getApiServices,
  registerUnauthorizedHandler,
  resetApiServicesForTests,
} from '@/data/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createRecordingFetch(
  routes: Array<{
    method: string;
    pathAndQuery: string;
    status?: number;
    body?: unknown;
  }>,
) {
  const calls: Array<{ method: string; url: string; body: unknown; headers: Record<string, string> }> = [];

  const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const parsedBody = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;

    if (method === 'GET' && url === '/api/v1/auth/csrf') {
      calls.push({ method, url, body: parsedBody, headers });
      return Promise.resolve(
        jsonResponse({ token: 'csrf-token-1', headerName: 'X-XSRF-TOKEN' }),
      );
    }

    const match = routes.find((r) => r.method === method && r.pathAndQuery === url);
    if (!match) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }

    calls.push({ method, url, body: parsedBody, headers });
    const status = match.status ?? 200;
    if (status === 204) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(jsonResponse(match.body, status));
  });

  return { fetchMock, calls };
}

describe('HTTP API Repositories Contract (27 Paths / 37 Operations)', () => {
  it('executes all 10 Auth & Users endpoints with exact paths, payloads, and CSRF invalidation', async () => {
    const sampleUser = {
      id: 1,
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      timezone: 'America/Lima',
      timeFormat: '24H',
      createdAt: '2026-11-20T10:00:00Z',
      remainingRecoveryCodes: 8,
    };

    const { fetchMock, calls } = createRecordingFetch([
      {
        method: 'POST',
        pathAndQuery: '/api/v1/auth/register',
        status: 201,
        body: {
          user: sampleUser,
          recoveryCodes: ['A1B2-C3D4'],
          recoveryCodesNotice: 'Guarda estos códigos.',
        },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/auth/login',
        body: { ...sampleUser, timeFormat: '12H' },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/auth/logout',
        status: 204,
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/auth/recover-password',
        body: { message: 'Contraseña restablecida.' },
      },
      {
        method: 'GET',
        pathAndQuery: '/api/v1/users/me',
        body: sampleUser,
      },
      {
        method: 'PATCH',
        pathAndQuery: '/api/v1/users/me',
        body: { ...sampleUser, timeFormat: '12H', displayName: 'Ana G.' },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/users/me/password',
        body: { message: 'Contraseña actualizada.' },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/users/me/recovery-codes/regenerate',
        body: { recoveryCodes: ['9999-8888'], recoveryCodesNotice: 'Nuevos códigos.' },
      },
      {
        method: 'DELETE',
        pathAndQuery: '/api/v1/users/me',
        status: 204,
      },
    ]);

    const client = new ApiHttpClient({ fetchFn: fetchMock });
    const authApi = new HttpAuthApiClient(client);

    // 1 + 2: CSRF bootstrap + register
    const reg = await authApi.register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password123',
      timezone: 'America/Lima',
    });
    expect(reg.user.id).toBe('1');
    expect(reg.recoveryCodes).toEqual(['A1B2-C3D4']);

    // 3: login (CSRF invalidated after register -> re-fetched)
    const loggedIn = await authApi.login({
      email: 'ana@example.com',
      password: 'Password123',
      timezone: 'America/Lima',
    });
    expect(loggedIn.timeFormat).toBe('12h');

    // 4: logout with push endpoint
    await authApi.logout('https://push.example/sub-1');

    // 5: recover-password
    const recoveredMsg = await authApi.recoverPassword({
      email: 'ana@example.com',
      recoveryCode: 'A1B2-C3D4',
      newPassword: 'NewPassword123',
    });
    expect(recoveredMsg).toBe('Contraseña restablecida.');

    // 6: getMe
    const me = await authApi.getMe('session-probe');
    expect(me.timeZone).toBe('America/Lima');

    // 7: updateProfile
    const updated = await authApi.updateProfile({
      displayName: 'Ana G.',
      timeFormat: '12h',
    });
    expect(updated.displayName).toBe('Ana G.');
    expect(updated.timeFormat).toBe('12h');

    // 8: changePassword
    expect(
      await authApi.changePassword({ currentPassword: 'old', newPassword: 'newPassword' }),
    ).toBe('Contraseña actualizada.');

    // 9: regenerateRecoveryCodes
    const regen = await authApi.regenerateRecoveryCodes({ currentPassword: 'newPassword' });
    expect(regen.recoveryCodes).toEqual(['9999-8888']);

    // 10: deleteAccount sends { password }
    await authApi.deleteAccount({ password: 'newPassword' });

    const csrfCalls = calls.filter((c) => c.url === '/api/v1/auth/csrf');
    expect(csrfCalls.length).toBe(4); // register, login, logout, recover (invalidated after register, login, logout)
    expect(calls.find((c) => c.url === '/api/v1/auth/logout')?.body).toEqual({
      endpoint: 'https://push.example/sub-1',
    });
    expect(calls.find((c) => c.method === 'PATCH' && c.url === '/api/v1/users/me')?.body).toEqual({
      displayName: 'Ana G.',
      timeFormat: '12H',
    });
    expect(calls.find((c) => c.method === 'DELETE' && c.url === '/api/v1/users/me')?.body).toEqual({
      password: 'newPassword',
    });
  });

  it('executes all 5 Groups endpoints', async () => {
    const groupDto = {
      id: 1,
      name: 'Personal',
      isPersonal: true,
      creatorId: 5,
      createdAt: '2026-11-20T09:00:00Z',
    };
    const workDto = {
      id: 2,
      name: 'Trabajo',
      isPersonal: false,
      creatorId: 5,
      createdAt: '2026-11-20T09:05:00Z',
    };

    const { fetchMock, calls } = createRecordingFetch([
      {
        method: 'GET',
        pathAndQuery: '/api/v1/groups?cursor=cur1&limit=10',
        body: { content: [groupDto], nextCursor: 'cur2', hasNext: true, size: 1 },
      },
      { method: 'GET', pathAndQuery: '/api/v1/groups/2', body: workDto },
      { method: 'POST', pathAndQuery: '/api/v1/groups', status: 201, body: workDto },
      {
        method: 'PATCH',
        pathAndQuery: '/api/v1/groups/2',
        body: { ...workDto, name: 'Estudio' },
      },
      { method: 'DELETE', pathAndQuery: '/api/v1/groups/2', status: 204 },
    ]);

    const repo = new HttpGroupsApiRepository(new ApiHttpClient({ fetchFn: fetchMock }));

    const page = await repo.listGroups({ cursor: 'cur1', limit: 10 });
    expect(page.content[0]?.members[0]?.role).toBe('creator');
    expect(page.hasNext).toBe(true);

    expect((await repo.getGroup('2')).name).toBe('Trabajo');
    expect((await repo.createGroup('Trabajo')).id).toBe('2');
    expect((await repo.renameGroup('2', 'Estudio')).name).toBe('Estudio');
    await repo.deleteGroup('2');

    expect(calls.some((c) => c.method === 'POST' && c.body && (c.body as { name: string }).name === 'Trabajo')).toBe(true);
  });

  it('executes all 10 Tasks endpoints including explicit null PATCH fields and repeated groupIds', async () => {
    const taskDto = {
      id: 42,
      groupId: 1,
      assignedUserId: null,
      title: 'Estudiar',
      description: null,
      completed: false,
      completedAt: null,
      overdue: false,
      dueDate: '2026-12-01',
      dueTime: '14:30:00',
      tags: [{ id: 10, groupId: 1, name: 'examen' }],
      createdAt: '2026-11-20T10:00:00Z',
    };

    const { fetchMock, calls } = createRecordingFetch([
      {
        method: 'GET',
        pathAndQuery: '/api/v1/tasks?groupIds=1&groupIds=2&status=PENDING&search=est&limit=20',
        body: { content: [taskDto], nextCursor: null, hasNext: false, size: 1 },
      },
      {
        method: 'GET',
        pathAndQuery: '/api/v1/groups/1/tasks?status=ALL&cursor=c1&limit=15',
        body: { content: [taskDto], nextCursor: null, hasNext: false, size: 1 },
      },
      { method: 'GET', pathAndQuery: '/api/v1/tasks/42', body: taskDto },
      { method: 'POST', pathAndQuery: '/api/v1/groups/1/tasks', status: 201, body: taskDto },
      {
        method: 'PATCH',
        pathAndQuery: '/api/v1/tasks/42',
        body: { ...taskDto, description: null, dueDate: null, dueTime: null, tags: [] },
      },
      { method: 'DELETE', pathAndQuery: '/api/v1/tasks/42', status: 204 },
      {
        method: 'PATCH',
        pathAndQuery: '/api/v1/tasks/42/completion',
        body: { ...taskDto, completed: true, completedAt: '2026-11-21T10:00:00Z' },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/tasks/42/move',
        body: { ...taskDto, groupId: 2 },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/tasks/42/copy',
        status: 201,
        body: { ...taskDto, id: 43, groupId: 2 },
      },
      { method: 'DELETE', pathAndQuery: '/api/v1/tasks/42/tags/10', status: 204 },
    ]);

    const repo = new HttpTasksApiRepository(new ApiHttpClient({ fetchFn: fetchMock }));

    const list = await repo.listTasks({
      groupIds: ['1', '2'],
      status: 'PENDING',
      search: ' est ',
    });
    expect(list.content[0]?.task.dueTime).toBe('14:30');
    expect(list.content[0]?.tags[0]?.name).toBe('examen');

    const groupList = await repo.listGroupTasks('1', {
      status: 'ALL',
      cursor: 'c1',
      limit: 15,
    });
    expect(groupList.content).toHaveLength(1);

    expect((await repo.getTask('42')).task.id).toBe('42');

    const created = await repo.createTask('1', {
      title: 'Estudiar',
      dueDate: '2026-12-01',
      dueTime: '14:30',
      tags: ['examen'],
    });
    expect(created.task.id).toBe('42');

    await repo.updateTask('42', {
      description: null,
      dueDate: null,
      dueTime: null,
      tags: null,
    });
    const patchCall = calls.find((c) => c.method === 'PATCH' && c.url === '/api/v1/tasks/42');
    expect(patchCall?.body).toEqual({
      description: null,
      dueDate: null,
      dueTime: null,
      tags: null,
    });

    expect((await repo.updateCompletion('42', true)).task.completed).toBe(true);
    expect((await repo.moveTask('42', '2')).task.groupId).toBe('2');
    expect((await repo.copyTask('42', '2')).task.id).toBe('43');
    await repo.detachTagFromTask('42', '10');
    await repo.deleteTask('42');
  });

  it('executes all 3 Tags endpoints including 200 reuse and 201 creation', async () => {
    const tagDto = { id: 10, groupId: 1, name: 'urgente' };

    const { fetchMock } = createRecordingFetch([
      {
        method: 'GET',
        pathAndQuery: '/api/v1/groups/1/tags?query=urg&limit=20',
        body: { content: [tagDto], nextCursor: null, hasNext: false, size: 1 },
      },
      { method: 'POST', pathAndQuery: '/api/v1/groups/1/tags', status: 200, body: tagDto },
      { method: 'DELETE', pathAndQuery: '/api/v1/groups/1/tags/10', status: 204 },
    ]);

    const repo = new HttpTagsApiRepository(new ApiHttpClient({ fetchFn: fetchMock }));

    const page = await repo.listGroupTags('1', { query: 'urg' });
    expect(page.content[0]).toEqual({ id: '10', groupId: '1', name: 'urgente' });
    expect(await repo.createOrReuseTag('1', 'urgente')).toEqual({
      id: '10',
      groupId: '1',
      name: 'urgente',
    });
    await repo.deleteGroupTag('1', '10');
  });

  it('executes all 9 Notifications & Web Push endpoints', async () => {
    const notifDto = {
      id: 12,
      eventType: 'TASK_DUE',
      content: 'La tarea vence hoy',
      read: false,
      createdAt: '2026-11-20T12:00:00Z',
    };

    const { fetchMock } = createRecordingFetch([
      {
        method: 'GET',
        pathAndQuery: '/api/v1/notifications?cursor=n1&limit=10&unreadOnly=true',
        body: { content: [notifDto], nextCursor: null, hasNext: false, size: 1 },
      },
      {
        method: 'GET',
        pathAndQuery: '/api/v1/notifications/unread-count',
        body: { unreadCount: 3 },
      },
      {
        method: 'PATCH',
        pathAndQuery: '/api/v1/notifications/12/read',
        body: { ...notifDto, read: true },
      },
      {
        method: 'PATCH',
        pathAndQuery: '/api/v1/notifications/read-all',
        body: { updatedCount: 3 },
      },
      { method: 'DELETE', pathAndQuery: '/api/v1/notifications/12', status: 204 },
      {
        method: 'GET',
        pathAndQuery: '/api/v1/notifications/push/vapid-public-key',
        body: { enabled: true, publicKey: 'BEl62iUYg' },
      },
      {
        method: 'POST',
        pathAndQuery: '/api/v1/notifications/push/subscriptions',
        status: 201,
        body: {
          id: 5,
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
          createdAt: '2026-11-20T12:00:00Z',
        },
      },
      {
        method: 'DELETE',
        pathAndQuery:
          '/api/v1/notifications/push/subscriptions?endpoint=https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fabc',
        status: 204,
      },
      {
        method: 'DELETE',
        pathAndQuery: '/api/v1/notifications/push/subscriptions/5',
        status: 204,
      },
    ]);

    const repo = new HttpNotificationsApiRepository(new ApiHttpClient({ fetchFn: fetchMock }));

    const page = await repo.listNotifications('7', {
      cursor: 'n1',
      limit: 10,
      unreadOnly: true,
    });
    expect(page.content[0]?.userId).toBe('7');
    expect(await repo.getUnreadCount()).toBe(3);
    expect((await repo.markAsRead('12', '7')).read).toBe(true);
    expect(await repo.markAllAsRead()).toBe(3);
    await repo.deleteNotification('12');

    expect(await repo.getVapidPublicKey()).toEqual({
      enabled: true,
      publicKey: 'BEl62iUYg',
    });
    const sub = await repo.registerPushSubscription({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
    expect(sub.id).toBe('5');
    await repo.deletePushSubscriptionByEndpoint('https://fcm.googleapis.com/fcm/send/abc');
    await repo.deletePushSubscriptionById('5');
  });

  it('wires runtime ApiServices singleton, test overrides, and unauthorized handler', async () => {
    resetApiServicesForTests();
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);

    const services = getApiServices();
    expect(services.authApi).toBeDefined();
    expect(services.groupsApi).toBeDefined();
    expect(services.tasksApi).toBeDefined();
    expect(services.tagsApi).toBeDefined();
    expect(services.notificationsApi).toBeDefined();

    const customAuth = { ...services.authApi };
    configureApiServicesForTests({ authApi: customAuth });
    expect(getApiServices().authApi).toBe(customAuth);

    resetApiServicesForTests();
    registerUnauthorizedHandler(null);
  });
});
