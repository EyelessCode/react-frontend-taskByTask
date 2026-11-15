import { test, expect } from '@playwright/test';
import { clearAppStorage, registerUserAndContinue } from './helpers/auth-e2e';

test.describe('App baseline smoke test', () => {
  test('unauthenticated / redirects to /login and authenticated / loads without console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await clearAppStorage(page);
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await registerUserAndContinue(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Task by Task' })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
