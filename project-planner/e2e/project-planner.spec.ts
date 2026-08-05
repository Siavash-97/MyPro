import { expect, test } from '@playwright/test';

test('creates and reopens a task through the real browser UI', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('MyProSole Projektplaner')).toBeVisible();
  await page.getByRole('button', { name: '+ Aufgabe' }).click();

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' });
  await expect(modal).toBeVisible();
  const titleField = modal.locator('label').filter({ hasText: /^Titel$/ }).locator('..').locator('input');
  await titleField.fill('Automatischer Browser-Test');
  await modal.getByRole('button', { name: 'Speichern' }).click();

  await page.getByRole('button', { name: 'Zeitplan' }).click();
  const createdTask = page.getByText('Automatischer Browser-Test', { exact: true }).first();
  await expect(createdTask).toBeVisible();
  await createdTask.click();
  await expect(page.getByText('Aufgabe bearbeiten')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
});

test('shows one complete calendar year with year navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zeitplan' }).click();
  await page.getByRole('button', { name: 'Jahre' }).click();

  await expect(page.getByTitle('Vorheriges Jahr')).toBeVisible();
  await expect(page.getByTitle('Nächstes Jahr')).toBeVisible();
  for (const month of ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']) {
    await expect(page.getByText(month, { exact: true })).toBeVisible();
  }
});

test('moves a To-Do to completed by drag and drop and keeps the change', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'To-Dos' }).click();

  const notStarted = page.getByTestId('todo-column-not_started');
  const completed = page.getByTestId('todo-column-completed');
  const card = page.getByTestId('todo-card-tk-4');

  await expect(page.getByRole('heading', { name: 'To-Do Kanban' })).toBeVisible();
  await expect(notStarted.getByTestId('todo-card-tk-4')).toBeVisible();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent('dragstart', { dataTransfer });
  await completed.dispatchEvent('dragover', { dataTransfer });
  await completed.dispatchEvent('drop', { dataTransfer });
  await card.dispatchEvent('dragend', { dataTransfer });
  await expect(completed.getByTestId('todo-card-tk-4')).toBeVisible();
  await expect(completed.getByTestId('todo-card-tk-4')).toContainText('100%');

  await page.reload();
  await page.getByRole('button', { name: 'To-Dos' }).click();
  await expect(page.getByTestId('todo-column-completed').getByTestId('todo-card-tk-4')).toBeVisible();
});
