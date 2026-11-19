import { test, expect } from '@playwright/test';
import { clearAppStorage, registerUserAndContinue } from './helpers/auth-e2e';

test.describe('Authentication, Recovery, Profile & Isolation E2E (004-auth)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
  });

  test('enforces route guards, registration codes, lockout across reload, single-use recovery, and session expiry', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Unauthenticated / redirects to /login
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    // Register user, verify 8 one-time recovery codes, enter workspace
    const { email, recoveryCodes } = await registerUserAndContinue(page);
    await expect(page.locator('.group-card', { hasText: 'Personal' })).toBeVisible();

    // Reload keeps user authenticated (and /register redirects to /)
    await page.reload();
    await expect(page.getByText('Hola, Ana García')).toBeVisible();

    // Explicit logout -> /login without sessionExpired notice
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Tu sesión ha expirado. Inicia sesión nuevamente.')).not.toBeVisible();

    // 5 failed logins -> temporary lockout notice that persists across reload
    for (let i = 0; i < 4; i += 1) {
      await page.getByLabel('Correo electrónico').fill(email);
      await page.getByLabel('Contraseña').fill('WrongPass1');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByText('Correo electrónico o contraseña incorrectos.')).toBeVisible();
    }
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/Demasiados intentos fallidos\. Espera/)).toBeVisible();

    await page.reload();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill('Password1');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/Demasiados intentos fallidos\. Espera/)).toBeVisible();

    // Recover password with single-use code -> redirects to /login with success notice
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/recover$/);
    await expect(page.getByText(/Cada código es de un solo uso\./)).toBeVisible();

    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Código de recuperación').fill(recoveryCodes[0]!);
    await page.getByLabel('Nueva contraseña').fill('Recovered123');
    await page.getByRole('button', { name: 'Restablecer contraseña' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText('Tu contraseña ha sido restablecida. Ya puedes iniciar sesión.'),
    ).toBeVisible();

    // Verify used recovery code cannot be reused
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Código de recuperación').fill(recoveryCodes[0]!);
    await page.getByLabel('Nueva contraseña').fill('AnotherPass1');
    await page.getByRole('button', { name: 'Restablecer contraseña' }).click();
    await expect(
      page.getByText('El correo o el código de recuperación no es válido o ya fue utilizado.'),
    ).toBeVisible();

    // Sign in with new password
    await page.getByRole('button', { name: '¿Ya tienes cuenta? Inicia sesión' }).click();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill('Recovered123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Hola, Ana García')).toBeVisible();

    // Tamper session expiration -> reload redirects to /login with sessionExpired notice
    await page.evaluate(() => {
      const raw = localStorage.getItem('tbt:v1:session');
      if (raw) {
        const parsed = JSON.parse(raw) as { expiresAt: string };
        parsed.expiresAt = '2000-01-01T00:00:00.000Z';
        localStorage.setItem('tbt:v1:session', JSON.stringify(parsed));
      }
    });
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Tu sesión ha expirado. Inicia sesión nuevamente.')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('supports 12h timeFormat propagation, password change, code regeneration, two-user isolation, and account deletion', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // User A registers and creates a group
    await registerUserAndContinue(page, {
      email: 'usera@example.com',
      username: 'UserA1',
      displayName: 'Usuario A',
      password: 'Password1',
    });

    await page.getByRole('button', { name: /Nuevo grupo/i }).click();
    const groupModal = page.getByRole('dialog');
    await groupModal.getByLabel('Nombre del grupo').fill('Trabajo A');
    await groupModal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('.group-card', { hasText: 'Trabajo A' })).toBeVisible();

    // Update profile to 12h format
    await page.getByRole('button', { name: 'Mi perfil' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByLabel('Formato de hora').selectOption('12h');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Perfil y preferencias actualizados.')).toBeVisible();
    const storedUsers = await page.evaluate(() => localStorage.getItem('tbt:v1:users'));
    expect(storedUsers).toContain('"timeFormat":"12h"');

    // Return to workspace and create task using 12h controls
    await page.getByRole('button', { name: 'Volver a mis grupos' }).click();
    await expect(page).toHaveURL(/\/$/);
    const personalCard = page.locator('.group-card', { hasText: 'Personal' });
    await personalCard.getByRole('button', { name: /Nueva tarea/i }).click();

    const taskModal = page.getByRole('dialog');
    await taskModal.getByLabel('Título').fill('Reunión 12h');
    await taskModal.getByLabel('Fecha de caducidad').fill('2026-12-20');
    await taskModal.getByLabel('Hora (12 horas)').selectOption('02');
    await taskModal.getByLabel('Minutos').selectOption('30');
    await taskModal.getByLabel('Periodo (AM/PM)').selectOption('pm');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    const taskCard = page.locator('.card', { hasText: 'Reunión 12h' });
    await expect(taskCard).toBeVisible();
    await expect(taskCard).toContainText('02:30 p. m.');

    // Profile: change password, regenerate recovery codes, and delete User A's account
    await page.getByRole('button', { name: 'Mi perfil' }).click();
    await page.locator('#profile-current-password-input').fill('Password1');
    await page.locator('#profile-new-password-input').fill('NewPass123');
    await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
    await expect(page.getByText('Contraseña actualizada correctamente.')).toBeVisible();

    await page.locator('#profile-regen-password-input').fill('NewPass123');
    await page.getByRole('button', { name: 'Regenerar códigos' }).click();
    await expect(page.getByText('Nuevos códigos de recuperación')).toBeVisible();

    await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
    const deleteModal = page.getByRole('dialog');
    await expect(deleteModal.getByText('Eliminar cuenta permanentemente')).toBeVisible();
    await deleteModal.locator('#delete-account-current-password').fill('NewPass123');
    await deleteModal.getByRole('button', { name: 'Eliminar cuenta definitivamente' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Tu cuenta y todos tus datos han sido eliminados.')).toBeVisible();

    // User B registers and sees only a clean Personal workspace
    await registerUserAndContinue(page, {
      email: 'userb@example.com',
      username: 'UserB1',
      displayName: 'Usuario B',
      password: 'Password1',
    });
    await expect(page.locator('.group-card', { hasText: 'Personal' })).toBeVisible();
    await expect(page.locator('.group-card', { hasText: 'Trabajo A' })).not.toBeVisible();
    await expect(page.locator('.card', { hasText: 'Reunión 12h' })).not.toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('renders auth, workspace, and profile views cleanly at ~375px mobile width without horizontal overflow', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await registerUserAndContinue(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.getByRole('button', { name: 'Mi perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Perfil y preferencias' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
