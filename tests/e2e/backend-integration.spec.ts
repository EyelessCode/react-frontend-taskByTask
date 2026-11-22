import { test, expect, type Page } from '@playwright/test';

function trackRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Failed to load resource: the server responded with a status of')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  return { consoleErrors, pageErrors };
}

test.describe('Backend Integration API-Mode E2E (T11, AC-BI-01..AC-BI-10)', () => {
  test('desktop 1280x720: auth, CSRF, 429/400 RFC 7807, paginated groups/tasks/notifications, move, and mid-session 401', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = trackRuntimeErrors(page);

    let sessionActive = false;
    let failLoginWith429 = true;
    let failTaskCreateWith400 = true;
    let failNextRefreshWith401 = false;
    let taskMoved = false;
    let unreadCount = 1;
    const csrfTokensSeen: string[] = [];

    const userDto = {
      id: 1,
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      timezone: 'America/Bogota',
      timeFormat: '24H',
      remainingRecoveryCodes: 8,
      createdAt: '2026-11-20T09:00:00Z',
    };

    const personalGroup = {
      id: 1,
      name: 'Personal',
      isPersonal: true,
      creatorId: 1,
      createdAt: '2026-11-20T09:00:00Z',
    };

    const workGroup = {
      id: 2,
      name: 'Trabajo',
      isPersonal: false,
      creatorId: 1,
      createdAt: '2026-11-20T09:05:00Z',
    };

    const taskA = {
      id: 101,
      title: 'Tarea A vencida',
      description: null,
      groupId: 1,
      completed: false,
      dueDate: '2026-11-01',
      dueTime: '09:00',
      overdue: true,
      assignedUserId: null,
      tags: [],
      createdAt: '2026-11-20T10:00:00Z',
      completedAt: null,
    };

    const taskB = {
      id: 102,
      title: 'Tarea B paginada',
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
    };

    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method().toUpperCase();
      const xsrf = request.headers()['x-xsrf-token'];
      if (xsrf) {
        csrfTokensSeen.push(xsrf);
      }

      if (path === '/api/v1/auth/csrf' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'csrf-e2e-1', headerName: 'X-XSRF-TOKEN' }),
        });
        return;
      }

      if (path === '/api/v1/users/me' && method === 'GET') {
        if (!sessionActive) {
          await route.fulfill({
            status: 401,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 401, detail: 'No autenticado' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(userDto),
        });
        return;
      }

      if (path === '/api/v1/auth/register' && method === 'POST') {
        sessionActive = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            user: userDto,
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
            recoveryCodesNotice: 'Guarda estos 8 códigos en un lugar seguro.',
          }),
        });
        return;
      }

      if (path === '/api/v1/auth/logout' && method === 'POST') {
        sessionActive = false;
        await route.fulfill({ status: 204 });
        return;
      }

      if (path === '/api/v1/auth/login' && method === 'POST') {
        if (failLoginWith429) {
          failLoginWith429 = false;
          await route.fulfill({
            status: 429,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              status: 429,
              detail: 'Demasiados intentos.',
              retryAfterSeconds: 45,
            }),
          });
          return;
        }
        sessionActive = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(userDto),
        });
        return;
      }

      if (path === '/api/v1/groups' && method === 'GET') {
        if (failNextRefreshWith401) {
          sessionActive = false;
          await route.fulfill({
            status: 401,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 401, detail: 'Sesión expirada' }),
          });
          return;
        }
        const cursor = url.searchParams.get('cursor');
        if (cursor === 'g-2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: [workGroup],
              nextCursor: null,
              hasNext: false,
              size: 1,
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [personalGroup],
            nextCursor: 'g-2',
            hasNext: true,
            size: 1,
          }),
        });
        return;
      }

      if (path === '/api/v1/groups/1/tasks' && method === 'GET') {
        const cursor = url.searchParams.get('cursor');
        if (cursor === 't-2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: [taskB],
              nextCursor: null,
              hasNext: false,
              size: 1,
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [taskA],
            nextCursor: 't-2',
            hasNext: true,
            size: 1,
          }),
        });
        return;
      }

      if (path === '/api/v1/groups/2/tasks' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: taskMoved ? [{ ...taskB, groupId: 2 }] : [],
            nextCursor: null,
            hasNext: false,
            size: taskMoved ? 1 : 0,
          }),
        });
        return;
      }

      if (path.endsWith('/tags') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: [], nextCursor: null, hasNext: false, size: 0 }),
        });
        return;
      }

      if (path === '/api/v1/groups/1/tasks' && method === 'POST') {
        if (failTaskCreateWith400) {
          failTaskCreateWith400 = false;
          await route.fulfill({
            status: 400,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              status: 400,
              detail: 'Revisa los campos de la tarea.',
              invalidParams: [{ name: 'title', reason: 'El título no es válido según el servidor.' }],
            }),
          });
          return;
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 103,
            title: 'Tarea C creada',
            description: null,
            groupId: 1,
            completed: false,
            dueDate: null,
            dueTime: null,
            overdue: false,
            assignedUserId: null,
            tags: [],
            createdAt: '2026-11-20T10:10:00Z',
            completedAt: null,
          }),
        });
        return;
      }

      if (path === '/api/v1/tasks/102/move' && method === 'POST') {
        taskMoved = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...taskB, groupId: 2 }),
        });
        return;
      }

      if (path === '/api/v1/notifications/unread-count' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ unreadCount }),
        });
        return;
      }

      if (path === '/api/v1/notifications/push/vapid-public-key' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ enabled: false, publicKey: null }),
        });
        return;
      }

      if (path === '/api/v1/notifications' && method === 'GET') {
        const cursor = url.searchParams.get('cursor');
        if (cursor === 'n-2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: [
                {
                  id: 22,
                  eventType: 'TASK_DUE',
                  content: 'Notificación 2 paginada',
                  read: true,
                  createdAt: '2026-11-20T12:00:00Z',
                },
              ],
              nextCursor: null,
              hasNext: false,
              size: 1,
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [
              {
                id: 21,
                eventType: 'TASK_DUE',
                content: 'Notificación 1 sin leer',
                read: false,
                createdAt: '2026-11-20T13:00:00Z',
              },
            ],
            nextCursor: 'n-2',
            hasNext: true,
            size: 1,
          }),
        });
        return;
      }

      if (path === '/api/v1/notifications/read-all' && method === 'PATCH') {
        unreadCount = 0;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updatedCount: 1 }),
        });
        return;
      }

      await route.fulfill({ status: 404 });
    });

    // Cold-start 401 -> silent redirect to /login
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText('Tu sesión ha expirado. Inicia sesión nuevamente.'),
    ).not.toBeVisible();

    // Register user -> 8 one-time recovery codes -> continue to workspace
    await page.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }).click();
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByLabel('Nombre de usuario').fill('Ana123');
    await page.getByLabel('Nombre para mostrar').fill('Ana García');
    await page.getByLabel('Contraseña').fill('Secret123');
    await page.getByRole('button', { name: 'Registrarse' }).click();

    await expect(page.getByText('Guarda estos 8 códigos en un lugar seguro.')).toBeVisible();
    await expect(page.getByText('A1B2-C3D4')).toBeVisible();
    await page.getByRole('button', { name: 'He guardado mis códigos, continuar' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Logout cleanly without sessionExpired notice
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText('Tu sesión ha expirado. Inicia sesión nuevamente.'),
    ).not.toBeVisible();

    // 429 cooldown on login -> then successful login
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByLabel('Contraseña').fill('Secret123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(
      page.getByText('Demasiados intentos fallidos. Espera 45 s antes de intentar de nuevo.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Verify N+ badge, active-tab-only count, authoritative overdue badge, and CSRF headers
    expect(csrfTokensSeen.length).toBeGreaterThan(0);
    await expect(page.getByText('Tarea A vencida')).toBeVisible();
    await expect(page.getByText('Vencida', { exact: true })).toBeVisible();
    await expect(page.getByText('1+ tareas')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pendientes (1+)' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Completadas' })).toBeVisible();

    // Load more tasks inside Personal card
    await page.getByRole('button', { name: /Cargar más tareas/i }).click();
    await expect(page.getByText('Tarea B paginada')).toBeVisible();
    await expect(page.getByText('2 tareas')).toBeVisible();

    // Task form RFC 7807 400 field error keeps modal open, then succeeds on retry
    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    const taskDialog = page.getByRole('dialog');
    await taskDialog.getByLabel('Título').fill('Tarea C creada');
    await taskDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskDialog.getByText('Revisa los campos de la tarea.')).toBeVisible();
    await expect(
      taskDialog.getByText('El título no es válido según el servidor.'),
    ).toBeVisible();
    await taskDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Tarea C creada')).toBeVisible();

    // Load more groups in grid footer & Move Tarea B to Trabajo
    await page.getByRole('button', { name: 'Cargar más grupos' }).last().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Trabajo' })).toBeVisible();

    const taskBCards = page.locator('.card', { hasText: 'Tarea B paginada' });
    await taskBCards.getByRole('button', { name: 'Opciones de la tarea' }).click();
    await page.getByRole('button', { name: 'Mover a…' }).click();
    const moveDialog = page.getByRole('dialog');
    await moveDialog.getByLabel('Seleccionar grupo destino').selectOption('2');
    await moveDialog.getByRole('button', { name: 'Mover' }).click();
    await expect(page.locator('.group-card', { hasText: 'Trabajo' }).getByText('Tarea B paginada')).toBeVisible();

    // Notification Center: disabled-by-server notice + Load More + mark all read
    await page.getByRole('button', { name: /Abrir centro de notificaciones/i }).click();
    const ntfDialog = page.getByRole('dialog');
    await expect(
      ntfDialog.getByText(
        'Los avisos emergentes del navegador están desactivados temporalmente en el servidor; seguirás recibiendo todas tus alertas aquí.',
      ),
    ).toBeVisible();
    await expect(ntfDialog.getByText('Notificación 1 sin leer')).toBeVisible();
    await ntfDialog.getByRole('button', { name: 'Cargar más notificaciones' }).click();
    await expect(ntfDialog.getByText('Notificación 2 paginada')).toBeVisible();
    await ntfDialog
      .getByRole('button', { name: 'Marcar todas las notificaciones como leídas' })
      .click();
    await ntfDialog.getByRole('button', { name: 'Cerrar centro de notificaciones' }).click();

    // Mid-session 401 -> redirects to /login with sessionExpired notice
    failNextRefreshWith401 = true;
    await page.getByRole('button', { name: 'Refrescar' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText('Tu sesión ha expirado. Inicia sesión nuevamente.'),
    ).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('mobile 375x812: Web Push VAPID enabled registration, profile 12H + remainingRecoveryCodes, and logout { endpoint } cleanup', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = trackRuntimeErrors(page);

    let sessionActive = true;
    const registeredPushPayloads: unknown[] = [];
    const logoutBodies: unknown[] = [];
    const deletePushCalls: string[] = [];
    const profilePatchBodies: unknown[] = [];

    await page.addInitScript(() => {
      const mockSubscription = {
        endpoint: 'https://push.example/mobile-device-1',
        toJSON: () => ({
          endpoint: 'https://push.example/mobile-device-1',
          keys: { p256dh: 'p256dh-mobile', auth: 'auth-mobile' },
        }),
        unsubscribe: async () => true,
      };
      const mockPushManager = {
        getSubscription: async () => mockSubscription,
        subscribe: async () => mockSubscription,
      };
      const mockRegistration = { pushManager: mockPushManager };

      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: class {
          static permission = 'granted';
          static async requestPermission() {
            return 'granted';
          }
        },
      });
      Object.defineProperty(window, 'PushManager', {
        configurable: true,
        value: function PushManager() {},
      });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          register: async () => mockRegistration,
          getRegistration: async () => mockRegistration,
        },
      });
    });

    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method().toUpperCase();

      if (path === '/api/v1/auth/csrf') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'csrf-mobile-1', headerName: 'X-XSRF-TOKEN' }),
        });
        return;
      }

      if (path === '/api/v1/users/me' && method === 'GET') {
        if (!sessionActive) {
          await route.fulfill({ status: 401 });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            email: 'ana@example.com',
            username: 'Ana123',
            displayName: 'Ana García',
            timezone: 'America/Bogota',
            timeFormat: '24H',
            remainingRecoveryCodes: 6,
            createdAt: '2026-11-20T09:00:00Z',
          }),
        });
        return;
      }

      if (path === '/api/v1/users/me' && method === 'PATCH') {
        profilePatchBodies.push(request.postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            email: 'ana@example.com',
            username: 'Ana123',
            displayName: 'Ana García',
            timezone: 'America/Bogota',
            timeFormat: '12H',
            remainingRecoveryCodes: 6,
            createdAt: '2026-11-20T09:00:00Z',
          }),
        });
        return;
      }

      if (path === '/api/v1/groups' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [
              {
                id: 1,
                name: 'Personal',
                isPersonal: true,
                creatorId: 1,
                createdAt: '2026-11-20T09:00:00Z',
              },
            ],
            nextCursor: null,
            hasNext: false,
            size: 1,
          }),
        });
        return;
      }

      if (path === '/api/v1/groups/1/tasks' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: [], nextCursor: null, hasNext: false, size: 0 }),
        });
        return;
      }

      if (path.endsWith('/tags') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: [], nextCursor: null, hasNext: false, size: 0 }),
        });
        return;
      }

      if (path === '/api/v1/notifications/unread-count' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ unreadCount: 0 }),
        });
        return;
      }

      if (path === '/api/v1/notifications/push/vapid-public-key' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ enabled: true, publicKey: 'SGVsbG8' }),
        });
        return;
      }

      if (path === '/api/v1/notifications/push/subscriptions' && method === 'POST') {
        registeredPushPayloads.push(request.postDataJSON());
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 77,
            endpoint: 'https://push.example/mobile-device-1',
            createdAt: '2026-11-20T14:00:00Z',
          }),
        });
        return;
      }

      if (path.startsWith('/api/v1/notifications/push/subscriptions') && method === 'DELETE') {
        deletePushCalls.push(path);
        await route.fulfill({ status: 204 });
        return;
      }

      if (path === '/api/v1/auth/logout' && method === 'POST') {
        sessionActive = false;
        logoutBodies.push(request.postDataJSON());
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fulfill({ status: 404 });
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2, name: 'Personal' })).toBeVisible();
    await expect
      .poll(() => registeredPushPayloads.length)
      .toBeGreaterThanOrEqual(1);
    expect(registeredPushPayloads[0]).toEqual({
      endpoint: 'https://push.example/mobile-device-1',
      keys: { p256dh: 'p256dh-mobile', auth: 'auth-mobile' },
    });

    // Check mobile layout fits 375px width without horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(overflow).toBe(true);

    // Navigate to Profile -> remainingRecoveryCodes + 12H save
    await page.getByRole('button', { name: 'Mi perfil' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText('Códigos de recuperación disponibles: 6 de 8')).toBeVisible();
    await page.getByLabel('Formato de hora').selectOption('12h');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Perfil y preferencias actualizados.')).toBeVisible();
    expect(profilePatchBodies[0]).toMatchObject({ timeFormat: '12H' });

    // Logout sends { endpoint } and never calls authenticated DELETE push subscriptions after logout
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(logoutBodies[0]).toEqual({ endpoint: 'https://push.example/mobile-device-1' });
    expect(deletePushCalls).toEqual([]);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
