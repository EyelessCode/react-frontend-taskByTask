import { test, expect } from '@playwright/test';

test.describe('Tasks Feature End-to-End Workflow (001-tasks)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should load app, initialize default Personal group, and run full task lifecycle with zero console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Initial Load & Seed Group Provisioning
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Task by Task' })).toBeVisible();
    await expect(page.getByLabel('Cambiar grupo activo')).toHaveValue('group-personal');
    await expect(page.locator('header span.fw-semibold', { hasText: 'Personal' })).toBeVisible();
    await expect(page.getByText('No hay tareas pendientes en este grupo')).toBeVisible();

    // 2. Create On-Time Task with Tags (using delimiter ;)
    await page.getByRole('button', { name: /Nueva tarea/i }).click();
    await expect(page.getByRole('heading', { name: 'Nueva tarea' })).toBeVisible();

    await page.getByLabel('Título').fill('Estudiar TypeScript 6');
    await page.getByLabel('Descripción').fill('Repasar tipos avanzados y compilador');
    await page.getByLabel('Fecha de caducidad').fill('2026-12-25');

    // Type tag with semicolon delimiter
    const tagInput = page.getByPlaceholder(
      'Escribe una etiqueta y presiona coma o punto y coma',
    );
    await tagInput.fill('Estudio;');

    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify created task card in DOM
    const taskCard = page.locator('.card', { hasText: 'Estudiar TypeScript 6' });
    await expect(taskCard).toBeVisible();
    await expect(taskCard.getByText('25/12/2026')).toBeVisible();
    await expect(taskCard.getByText('Estudio')).toBeVisible();
    await expect(taskCard.getByText('Vencida')).not.toBeVisible();

    // 3. Create Past-Due Overdue Task and verify visual red indicator & badge (REQ-TK-11)
    await page.getByRole('button', { name: /Nueva tarea/i }).click();
    await page.getByLabel('Título').fill('Tarea vencida de prueba');
    await page.getByLabel('Fecha de caducidad').fill('2020-01-01');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const overdueCard = page.locator('.card', { hasText: 'Tarea vencida de prueba' });
    await expect(overdueCard).toBeVisible();
    await expect(overdueCard).toHaveClass(/border-danger/);
    await expect(overdueCard.getByText('Vencida', { exact: true })).toBeVisible();

    // 4. Mark Overdue Task Complete and verify strikethrough & removal of badge/red styling (REQ-TK-14)
    const overdueCheckbox = overdueCard.getByRole('checkbox');
    await overdueCheckbox.click();

    // In 'Pendientes' tab, completed task disappears
    await expect(overdueCard).not.toBeVisible();

    // Switch to 'Completadas' tab
    await page.getByRole('tab', { name: /Completadas/i }).click();
    const completedOverdueCard = page.locator('.card', {
      hasText: 'Tarea vencida de prueba',
    });
    await expect(completedOverdueCard).toBeVisible();
    await expect(completedOverdueCard.getByRole('checkbox')).toBeChecked();
    await expect(completedOverdueCard).not.toHaveClass(/border-danger/);
    await expect(
      completedOverdueCard.getByText('Vencida', { exact: true }),
    ).not.toBeVisible();
    await expect(
      completedOverdueCard.locator('span.text-decoration-line-through'),
    ).toBeVisible();

    // 5. Switch to 'Todas' tab and verify deterministic partition (pending first, completed last) (REQ-TK-17)
    await page.getByRole('tab', { name: /Todas/i }).click();
    const allCards = page.locator('.task-list .card');
    await expect(allCards).toHaveCount(2);
    await expect(allCards.nth(0)).toContainText('Estudiar TypeScript 6');
    await expect(allCards.nth(1)).toContainText('Tarea vencida de prueba');

    // 6. Test Move modal empty state and Task Deletion
    await page.getByRole('tab', { name: /Pendientes/i }).click();

    const menuButton = page
      .locator('.card', { hasText: 'Estudiar TypeScript 6' })
      .getByRole('button', { name: 'Opciones de la tarea' });
    await menuButton.click();

    // Test 'Mover a…' with only 1 group (REQ-TK-19b)
    await page.getByRole('button', { name: 'Mover a…' }).click();
    await expect(page.getByRole('heading', { name: 'Mover tarea' })).toBeVisible();
    await expect(
      page.getByText(
        'No tienes otros grupos individuales disponibles para mover o copiar esta tarea.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mover' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Test 'Eliminar' (REQ-TK-07, REQ-TK-08)
    await menuButton.click();
    await page.getByRole('button', { name: 'Eliminar' }).click();
    const deleteModal = page.getByRole('dialog');
    await expect(
      deleteModal.getByRole('heading', { name: 'Eliminar tarea' }),
    ).toBeVisible();
    await deleteModal.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Deleted task disappears
    await expect(
      page.locator('.card', { hasText: 'Estudiar TypeScript 6' }),
    ).not.toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('should render responsively at mobile viewport (375x667) without errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Task by Task' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nueva tarea/i })).toBeVisible();
    await expect(page.getByRole('tablist')).toBeVisible();

    // Open modal on mobile
    await page.getByRole('button', { name: /Nueva tarea/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
