import { test, expect } from '@playwright/test';

test.describe('App baseline smoke test', () => {
  test('root / loads without unhandled console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    expect(consoleErrors).toEqual([]);
  });
});
