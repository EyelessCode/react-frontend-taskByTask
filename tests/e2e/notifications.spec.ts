import { test, expect, type Page } from '@playwright/test';
import { clearAppStorage, registerUserAndContinue } from './helpers/auth-e2e';

interface DispatchedBrowserNotification {
  title: string;
  body: string;
}

declare global {
  interface Window {
    __tbtPermState?: 'default' | 'granted' | 'denied';
    __tbtNextRequestResult?: 'default' | 'granted' | 'denied';
    __tbtNotifications?: DispatchedBrowserNotification[];
  }
}

async function installMockBrowserNotificationApi(
  page: Page,
  initialPermission: 'default' | 'granted' | 'denied' = 'default',
): Promise<void> {
  await page.addInitScript((perm) => {
    window.__tbtPermState = perm;
    window.__tbtNextRequestResult = 'granted';
    window.__tbtNotifications = [];

    class MockBrowserNotification {
      static get permission() {
        const override = localStorage.getItem('__tbtPermStateOverride');
        if (override === 'default' || override === 'granted' || override === 'denied') {
          return override;
        }
        return window.__tbtPermState ?? 'default';
      }
      static async requestPermission() {
        const next = window.__tbtNextRequestResult ?? 'granted';
        window.__tbtPermState = next;
        localStorage.setItem('__tbtPermStateOverride', next);
        return Promise.resolve(next);
      }
      constructor(title: string, options?: { body?: string }) {
        window.__tbtNotifications = window.__tbtNotifications ?? [];
        window.__tbtNotifications.push({
          title,
          body: options?.body ?? '',
        });
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: MockBrowserNotification,
    });
  }, initialPermission);
}

test.describe('Browser Notifications & In-App Notification Center E2E (005-notifications)', () => {
  test('AC-NT-01, AC-NT-02, AC-NT-04: discrete 8-hour per-user permission banner, denied guidance, and Activar avisos grant', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await installMockBrowserNotificationApi(page, 'default');
    await clearAppStorage(page);

    // User 1 registers -> sees discrete permission banner on workspace entry
    await registerUserAndContinue(page, {
      email: 'user1@example.com',
      username: 'UserOne1',
      displayName: 'Usuario Uno',
      password: 'Password1',
    });

    const banner = page.getByRole('region', { name: 'Activa los avisos del navegador' });
    await expect(banner).toBeVisible();

    // Clicking "Ahora no" hides banner and persists 8h cooldown across reload for User 1
    await banner.getByRole('button', { name: 'Ahora no' }).click();
    await expect(banner).not.toBeVisible();

    await page.reload();
    await expect(page.getByText('Hola, Usuario Uno')).toBeVisible();
    await expect(banner).not.toBeVisible();

    // Even while banner is within 8h cooldown, Notification Center panel offers manual "Activar avisos"
    await page.getByRole('button', { name: /Abrir centro de notificaciones/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Avisos del navegador pendientes de activar')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar centro de notificaciones' }).click();
    await expect(dialog).not.toBeVisible();

    // Logout User 1 and register User 2 on the same browser -> User 2 sees their own permission banner!
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await registerUserAndContinue(page, {
      email: 'user2@example.com',
      username: 'UserTwo2',
      displayName: 'Usuario Dos',
      password: 'Password2',
    });
    await expect(banner).toBeVisible();

    // User 2 clicks "Activar avisos" on the banner -> permission transitions to 'granted' & banner hides
    await banner.getByRole('button', { name: 'Activar avisos' }).click();
    await expect(banner).not.toBeVisible();

    await page.getByRole('button', { name: /Abrir centro de notificaciones/i }).click();
    await expect(dialog.getByText('Avisos del navegador activados')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Simulate browser 'denied' state and expired cooldown (> 8h ago) -> shows blocked instructions without dead prompt button
    await page.evaluate(() => {
      window.__tbtPermState = 'denied';
      localStorage.setItem('__tbtPermStateOverride', 'denied');
      const raw = localStorage.getItem('tbt:v1:notification_state');
      if (raw) {
        const states = JSON.parse(raw) as Array<{
          userId: string;
          permissionPromptLastShownAt: string | null;
        }>;
        for (const s of states) {
          s.permissionPromptLastShownAt = '2020-01-01T00:00:00.000Z';
        }
        localStorage.setItem('tbt:v1:notification_state', JSON.stringify(states));
      }
    });
    await page.reload();

    const blockedBanner = page.getByRole('region', {
      name: 'Notificaciones bloqueadas en este navegador',
    });
    await expect(blockedBanner).toBeVisible();
    await expect(
      blockedBanner.getByText(/Para reactivarlos, abre el ícono de candado/i),
    ).toBeVisible();
    await expect(blockedBanner.getByRole('button', { name: 'Activar avisos' })).not.toBeVisible();

    await page.getByRole('button', { name: /Abrir centro de notificaciones/i }).click();
    await expect(dialog.getByText('Avisos del navegador bloqueados')).toBeVisible();
    await expect(dialog.getByText(/Para reactivarlos, abre el ícono de candado/i)).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('AC-NT-03..AC-NT-10: today post-09:00 & timed scheduling, dedupe, cancellation, Notification Center read/delete/pruning, 12h format, and mobile 375px layout', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Fix browser clock to 2026-11-18 10:00:00 local time (>= 09:00 local)
    await page.clock.install({ time: new Date(2026, 10, 18, 10, 0, 0) });
    await installMockBrowserNotificationApi(page, 'granted');
    await clearAppStorage(page);

    await registerUserAndContinue(page, {
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });

    // Switch profile to 12h time format
    await page.getByRole('button', { name: 'Mi perfil' }).click();
    await page.getByLabel('Formato de hora').selectOption('12h');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Perfil y preferencias actualizados.')).toBeVisible();
    await page.getByRole('button', { name: 'Volver a mis grupos' }).click();

    const personalCard = page.locator('.group-card', { hasText: 'Personal' });
    await expect(personalCard).toBeVisible();

    // 1. Past-day date-only task ('2026-11-10') -> visually Vencida, zero notification spam on save or reload (AC-NT-03)
    await personalCard.getByRole('button', { name: /Nueva tarea/i }).click();
    const taskModal = page.getByRole('dialog');
    await taskModal.getByLabel('Título').fill('Tarea pasada sin spam');
    await taskModal.getByLabel('Fecha de caducidad').fill('2026-11-10');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Abrir centro de notificaciones (0 sin leer)' }),
    ).toBeVisible();

    // 2. Date-only task for today ('2026-11-18') saved at 10:00 (>= 09:00) -> fires immediately once! (AC-NT-03, AC-NT-04)
    await personalCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Entrega de hoy');
    await taskModal.getByLabel('Fecha de caducidad').fill('2026-11-18');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Abrir centro de notificaciones (1 sin leer)' }),
    ).toBeVisible();

    const popupsAfterToday = await page.evaluate(() => window.__tbtNotifications ?? []);
    expect(popupsAfterToday).toEqual([
      {
        title: 'Aviso de vencimiento',
        body: 'La tarea "Entrega de hoy" vence el 18/11/2026.',
      },
    ]);

    // 3. Reloading does NOT duplicate the today alert or fire the past-created task (AC-NT-06)
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Abrir centro de notificaciones (1 sin leer)' }),
    ).toBeVisible();

    // 4. Future timed task scheduled for 10:30 a. m. today, plus a second task that gets completed before 10:30 (AC-NT-03, AC-NT-05)
    await personalCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Reunión 10:30');
    await taskModal.getByLabel('Fecha de caducidad').fill('2026-11-18');
    await taskModal.getByLabel('Hora (12 horas)').selectOption('10');
    await taskModal.getByLabel('Minutos').selectOption('30');
    await taskModal.getByLabel('Periodo (AM/PM)').selectOption('am');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    await personalCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Cancelada al completar');
    await taskModal.getByLabel('Fecha de caducidad').fill('2026-11-18');
    await taskModal.getByLabel('Hora (12 horas)').selectOption('10');
    await taskModal.getByLabel('Minutos').selectOption('30');
    await taskModal.getByLabel('Periodo (AM/PM)').selectOption('am');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    // Complete "Cancelada al completar" before 10:30 -> its timer is cancelled
    const cancelledCard = page.locator('.card', { hasText: 'Cancelada al completar' });
    await cancelledCard.getByRole('checkbox').click();

    // Advance clock 30 minutes to 10:30:00 local -> "Reunión 10:30" fires, while "Cancelada al completar" does NOT!
    await page.clock.runFor(30 * 60 * 1000);

    await expect(
      page.getByRole('button', { name: 'Abrir centro de notificaciones (2 sin leer)' }),
    ).toBeVisible();

    // Seed a 35-day-old notification in localStorage to verify 30-day automatic pruning on opening the center (AC-NT-09)
    await page.evaluate(() => {
      const raw = localStorage.getItem('tbt:v1:notifications');
      const list = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const userId = list[0]?.userId;
      if (userId) {
        list.push({
          id: 'ntf-old-35d',
          userId,
          eventType: 'due_date',
          content: 'Notificación de hace 35 días',
          read: false,
          createdAt: '2026-10-01T10:00:00.000Z',
        });
        localStorage.setItem('tbt:v1:notifications', JSON.stringify(list));
      }
    });

    // 5. Open Notification Center at mobile 375x812 viewport and verify pruning, 12h formatting, markAsRead, markAllAsRead, and delete (AC-NT-08..10)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Abrir centro de notificaciones (2 sin leer)' }).click();

    const centerModal = page.getByRole('dialog');
    await expect(centerModal.getByRole('heading', { name: 'Centro de notificaciones' })).toBeVisible();
    await expect(centerModal.getByText('Notificación de hace 35 días')).not.toBeVisible();
    await expect(
      centerModal.getByText('La tarea "Reunión 10:30" vence el 18/11/2026 a las 10:30 a. m..'),
    ).toBeVisible();
    await expect(
      centerModal.getByText('La tarea "Entrega de hoy" vence el 18/11/2026.'),
    ).toBeVisible();
    await expect(centerModal.getByText('18/11/2026, 10:30 a. m.')).toBeVisible();
    await expect(centerModal.getByText('18/11/2026, 10:00 a. m.')).toBeVisible();

    // Mark one notification as read
    await centerModal.getByRole('button', { name: 'Marcar notificación como leída' }).first().click();
    await expect(
      page.getByRole('button', { name: 'Abrir centro de notificaciones (1 sin leer)' }),
    ).toBeVisible();

    // Mark all remaining as read -> button becomes disabled and unread count drops to 0
    const markAllBtn = centerModal.getByRole('button', {
      name: 'Marcar todas las notificaciones como leídas',
    });
    await expect(markAllBtn).toBeEnabled();
    await markAllBtn.click();
    await expect(markAllBtn).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Abrir centro de notificaciones (0 sin leer)' }),
    ).toBeVisible();

    // Delete both notifications -> empty state
    await centerModal.getByRole('button', { name: 'Eliminar notificación' }).first().click();
    await centerModal.getByRole('button', { name: 'Eliminar notificación' }).first().click();
    await expect(centerModal.getByText('No tienes notificaciones en este momento.')).toBeVisible();

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
