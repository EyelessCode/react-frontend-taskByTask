import { expect, type Page } from '@playwright/test';

export interface RegisterE2EUserOptions {
  email?: string;
  username?: string;
  displayName?: string;
  password?: string;
}

export interface RegisteredE2EUser {
  email: string;
  username: string;
  displayName: string;
  password: string;
  recoveryCodes: string[];
}

export async function clearAppStorage(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
}

export async function registerUserAndContinue(
  page: Page,
  options: RegisterE2EUserOptions = {},
): Promise<RegisteredE2EUser> {
  const email = options.email ?? 'ana@example.com';
  const username = options.username ?? 'Ana123';
  const displayName = options.displayName ?? 'Ana García';
  const password = options.password ?? 'Password1';

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();

  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Nombre de usuario').fill(username);
  await page.getByLabel('Nombre para mostrar').fill(displayName);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Registrarse' }).click();

  await expect(page.getByText('Guarda tus códigos de recuperación')).toBeVisible();

  const codeElements = page.locator('code');
  await expect(codeElements).toHaveCount(8);
  const recoveryCodes = await codeElements.allTextContents();

  await page.getByRole('button', { name: 'He guardado mis códigos, continuar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Hola, ${displayName}`)).toBeVisible();

  return { email, username, displayName, password, recoveryCodes };
}
