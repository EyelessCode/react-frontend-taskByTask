import { test, expect } from '@playwright/test';

test.describe('Tags Feature End-to-End Workflow (003-tags)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should run full RF-22 tag lifecycle across groups at desktop and mobile widths with zero console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    const personalGroupCard = page.locator('.group-card', { hasText: 'Personal' });
    await expect(personalGroupCard).toBeVisible();

    // 1. Delimited capture (; and ,), blur auto-capture, and > 30 char validation (AC-TG-01)
    await personalGroupCard.getByRole('button', { name: /Nueva tarea/i }).click();
    const taskModal = page.getByRole('dialog');
    await taskModal.getByLabel('Título').fill('Tarea Uno');

    const tagInput = taskModal.getByPlaceholder(
      'Escribe una etiqueta y presiona coma o punto y coma',
    );
    await tagInput.fill('x'.repeat(31));
    await tagInput.press('Enter');
    await expect(
      taskModal.getByText('El nombre de la etiqueta no puede exceder 30 caracteres'),
    ).toBeVisible();

    await tagInput.fill('');
    await tagInput.type('Trabajo;Urgente,');
    await tagInput.type('PendienteBlur');
    await taskModal.getByLabel('Título').focus(); // blur outside composite tag input
    await expect(taskModal.getByRole('button', { name: 'Editar etiqueta PendienteBlur' })).toBeVisible();

    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    const taskOneCard = page.locator('.card', { hasText: 'Tarea Uno' });
    await expect(taskOneCard.getByText('Trabajo')).toBeVisible();
    await expect(taskOneCard.getByText('Urgente')).toBeVisible();
    await expect(taskOneCard.getByText('PendienteBlur')).toBeVisible();

    // 2. Autocomplete suggestion selection & case-insensitive reuse (AC-TG-02, AC-TG-03)
    await personalGroupCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Tarea Dos');
    await tagInput.type('trab');
    await expect(taskModal.getByRole('button', { name: 'Trabajo' })).toBeVisible();
    await taskModal.getByRole('button', { name: 'Trabajo' }).click();
    await tagInput.type('urgente;'); // case-insensitive reuse -> "Urgente"
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    const taskTwoCard = page.locator('.card', { hasText: 'Tarea Dos' });
    await expect(taskTwoCard.getByText('Trabajo')).toBeVisible();
    await expect(taskTwoCard.getByText('Urgente')).toBeVisible();

    // 3. Inline chip editing on one task only (AC-TG-05)
    await taskTwoCard.getByRole('button', { name: 'Opciones de la tarea' }).click();
    await page.getByRole('button', { name: 'Editar' }).click();
    await taskModal.getByRole('button', { name: 'Editar etiqueta Trabajo' }).click();
    const inlineInput = taskModal.getByRole('textbox', { name: 'Editando etiqueta Trabajo' });
    await inlineInput.fill('Oficina');
    await inlineInput.press('Enter');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();

    await expect(taskTwoCard.getByText('Oficina')).toBeVisible();
    await expect(taskTwoCard.getByText('Trabajo')).not.toBeVisible();
    await expect(taskOneCard.getByText('Trabajo')).toBeVisible();

    // 4. TaskCard removal via "Solo de la tarea" keeps tag in group suggestions (AC-TG-04, AC-TG-08, AC-TG-09)
    await taskOneCard.getByRole('button', { name: 'Quitar etiqueta PendienteBlur' }).click();
    const removalModal = page.getByRole('dialog');
    await expect(
      removalModal.getByText(/Si eliges "Solo de la tarea", la etiqueta se conservará en el grupo/i),
    ).toBeVisible();
    await removalModal.getByRole('button', { name: 'Solo de la tarea' }).click();
    await expect(removalModal).not.toBeVisible();
    await expect(taskOneCard.getByText('PendienteBlur')).not.toBeVisible();

    // 5. TaskFormModal stacked removal via "Del grupo" preserves unsaved title edits (AC-TG-07, AC-TG-09)
    await taskOneCard.getByRole('button', { name: 'Opciones de la tarea' }).click();
    await page.getByRole('button', { name: 'Editar' }).click();
    await taskModal.getByLabel('Título').fill('Tarea Uno Editada');
    await taskModal.getByRole('button', { name: 'Quitar etiqueta Urgente' }).click();

    const stackedConfirm = page.getByRole('dialog').last();
    await stackedConfirm.getByRole('button', { name: 'Del grupo' }).click();
    await expect(taskModal.getByLabel('Título')).toHaveValue('Tarea Uno Editada');
    await expect(taskModal.getByRole('button', { name: 'Quitar etiqueta Urgente' })).not.toBeVisible();

    await taskModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(taskModal).not.toBeVisible();
    await expect(page.locator('.card', { hasText: 'Tarea Uno Editada' })).toBeVisible();
    await expect(taskTwoCard.getByText('Urgente')).not.toBeVisible();

    // 6. > 5 tags "+1 más" preview on card vs. full edit list (AC-TG-10)
    await personalGroupCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Tarea Con Seis');
    await tagInput.type('Uno;Dos;Tres;Cuatro;Cinco;Seis;');
    await taskModal.getByRole('button', { name: 'Guardar' }).click();

    const sixTagsCard = page.locator('.card', { hasText: 'Tarea Con Seis' });
    await expect(sixTagsCard.getByText('+1 más')).toBeVisible();
    await sixTagsCard.getByRole('button', { name: 'Opciones de la tarea' }).click();
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(taskModal.getByRole('button', { name: 'Editar etiqueta Seis' })).toBeVisible();
    await taskModal.getByRole('button', { name: 'Cancelar' }).click();

    // 7. Multi-group tag isolation (AC-TG-11) & Mobile ~375px check (AC-TG-12)
    await page.getByRole('button', { name: /Nuevo grupo/i }).click();
    const groupModal = page.getByRole('dialog');
    await groupModal.getByLabel('Nombre del grupo').fill('Universidad');
    await groupModal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(groupModal).not.toBeVisible();

    const uniCard = page.locator('.group-card', { hasText: 'Universidad' });
    await uniCard.getByRole('button', { name: /Nueva tarea/i }).click();
    await taskModal.getByLabel('Título').fill('Tarea Uni');
    await tagInput.type('Ofic');
    await expect(taskModal.getByRole('button', { name: 'Oficina' })).not.toBeVisible();
    await taskModal.getByRole('button', { name: 'Cancelar' }).click();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(personalGroupCard).toBeVisible();
    await expect(uniCard).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    expect(consoleErrors).toEqual([]);
  });
});
