import { test, expect } from '@playwright/test';
import { clearAppStorage, registerUserAndContinue } from './helpers/auth-e2e';

test.describe('Groups Feature End-to-End Workflow (002-groups)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await registerUserAndContinue(page);
  });

  test('should run full groups lifecycle and verify multi-criteria filtering, search, and cascade deletion', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // 1. Initial Load & Seed Group Provisioning (AC-GRP-01)
    await expect(page.getByRole('heading', { level: 1, name: 'Task by Task' })).toBeVisible();
    const personalGroupCard = page.locator('.group-card', { hasText: 'Personal' });
    await expect(personalGroupCard).toBeVisible();
    await expect(personalGroupCard.getByRole('heading', { level: 2, name: 'Personal' })).toBeVisible();
    await expect(personalGroupCard.locator('.badge', { hasText: 'Personal' })).toBeVisible();
    await expect(personalGroupCard.getByText('0 tareas')).toBeVisible();

    // Verify Personal context menu has no "Eliminar" (AC-GRP-04)
    const personalMenuToggle = personalGroupCard.getByRole('button', { name: 'Opciones del grupo' });
    await personalMenuToggle.click();
    await expect(page.getByRole('button', { name: 'Renombrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar' })).not.toBeVisible();
    await personalMenuToggle.click(); // Close menu

    // 2. Create New Group "Universidad" (AC-GRP-02)
    await page.getByRole('button', { name: /Nuevo grupo/i }).click();
    const createModal = page.getByRole('dialog');
    await expect(createModal.getByRole('heading', { name: 'Crear nuevo grupo' })).toBeVisible();

    await createModal.getByLabel('Nombre del grupo').fill('Universidad');
    await createModal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(createModal).not.toBeVisible();

    // Verify "Universidad" appears in grid and toolbar pills
    const uniGroupCard = page.locator('.group-card', { hasText: 'Universidad' });
    await expect(uniGroupCard).toBeVisible();
    await expect(page.getByRole('button', { name: 'Universidad' })).toBeVisible();

    // 3. Rename "Universidad" to "Facultad" (AC-GRP-03)
    const uniMenuToggle = uniGroupCard.getByRole('button', { name: 'Opciones del grupo' });
    await uniMenuToggle.click();
    await page.getByRole('button', { name: 'Renombrar' }).click();

    const renameModal = page.getByRole('dialog');
    await expect(renameModal.getByRole('heading', { name: 'Renombrar grupo' })).toBeVisible();
    await expect(renameModal.getByLabel('Nombre del grupo')).toHaveValue('Universidad');
    await renameModal.getByLabel('Nombre del grupo').fill('Facultad');
    await renameModal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(renameModal).not.toBeVisible();

    // Verify card title is now "Facultad"
    const facultadCard = page.locator('.group-card', { hasText: 'Facultad' });
    await expect(facultadCard).toBeVisible();

    // 4. Create tasks in "Personal" and "Facultad" via inline "+ Nueva tarea" (AC-GRP-09)
    await personalGroupCard.getByRole('button', { name: /Nueva tarea/i }).click();
    const taskModal = page.getByRole('dialog');
    await taskModal.getByLabel('Título').fill('Tarea Personal 1');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    await facultadCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Examen Final Cálculo');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    // Verify task counts update (AC-GRP-08)
    await expect(personalGroupCard.getByText('1 tarea')).toBeVisible();
    await expect(facultadCard.getByText('1 tarea')).toBeVisible();

    // 5. Title substring search across groups (AC-GRP-10, AC-GRP-11)
    const searchInput = page.getByPlaceholder('Buscar tareas por título...');
    await searchInput.fill('Cálculo');
    await expect(page.locator('.card', { hasText: 'Examen Final Cálculo' })).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Tarea Personal 1' })).not.toBeVisible();

    // Unmatched search query displays global alert banner (REQ-GRP-23)
    await searchInput.fill('Inexistente');
    await expect(page.getByText('No se encontraron tareas con el título especificado.')).toBeVisible();
    // Cards remain visible in grid
    await expect(personalGroupCard).toBeVisible();
    await expect(facultadCard).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.getByText('No se encontraron tareas con el título especificado.')).not.toBeVisible();

    // 6. Multi-group selector (AC-GRP-10)
    await page.getByRole('button', { name: 'Facultad' }).click();
    await expect(facultadCard).toBeVisible();
    await expect(personalGroupCard).not.toBeVisible();

    await page.getByRole('button', { name: 'Todos los grupos' }).click();
    await expect(facultadCard).toBeVisible();
    await expect(personalGroupCard).toBeVisible();

    // 7. Cascade delete group "Facultad" (AC-GRP-05, AC-GRP-06)
    const facultadMenuToggle = facultadCard.getByRole('button', { name: 'Opciones del grupo' });
    await facultadMenuToggle.click();
    await page.getByRole('button', { name: 'Eliminar' }).click();

    const deleteModal = page.getByRole('dialog');
    await expect(deleteModal.getByRole('heading', { name: 'Eliminar grupo' })).toBeVisible();
    await expect(deleteModal.getByText(/Todas sus tareas y etiquetas se eliminarán de forma permanente/i)).toBeVisible();

    await deleteModal.getByRole('button', { name: 'Eliminar' }).click();
    await expect(deleteModal).not.toBeVisible();

    // Verify group and its tasks are permanently removed
    await expect(page.locator('.group-card', { hasText: 'Facultad' })).not.toBeVisible();
    await expect(page.locator('.card', { hasText: 'Examen Final Cálculo' })).not.toBeVisible();
    await expect(personalGroupCard).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
