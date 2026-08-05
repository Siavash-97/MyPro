import { expect, test } from '@playwright/test';

test('creates and reopens a task through the real browser UI', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('MyProSole Projektplaner')).toBeVisible();
  await page.getByRole('button', { name: '+ Aufgabe' }).click();

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' });
  await expect(modal).toBeVisible();
  const titleField = modal.locator('label').filter({ hasText: /^Titel$/ }).locator('..').locator('input');
  await titleField.fill('Automatischer Browser-Test');
  const startField = modal.getByLabel('Startdatum');
  const initialStart = await startField.inputValue();

  await modal.getByRole('button', { name: 'Speichern' }).click();
  await expect(modal.getByText(/Bitte einen Vorgänger wählen/)).toBeVisible();
  await expect(modal.getByText(/Bitte einen Nachfolger wählen/)).toBeVisible();

  await modal.getByLabel('Vorgänger noch nicht bekannt').check();
  await modal.getByLabel('Nachfolger noch nicht bekannt').check();
  await startField.fill('');
  await modal.getByRole('button', { name: 'Speichern' }).click();
  await expect(modal.getByText('Bitte ein Startdatum eintragen.')).toBeVisible();

  await startField.fill(initialStart);
  await modal.getByRole('button', { name: 'Speichern' }).click();

  await page.getByRole('button', { name: 'Zeitplan' }).click();
  const createdTask = page.getByText('Automatischer Browser-Test', { exact: true }).first();
  await expect(createdTask).toBeVisible();
  await createdTask.click();
  await expect(page.getByText('Aufgabe bearbeiten')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
});

test('uses the predecessor end date as the new task start date', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Aufgabe' }).click();

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' });
  const expectedPredecessorEnd = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  await modal.getByLabel('Vorgänger hinzufügen').selectOption({ label: 'Sensor-Auswahl & Beschaffung' });
  await expect(modal.getByLabel('Startdatum')).toHaveValue(expectedPredecessorEnd);
  await expect(modal.getByLabel('Enddatum')).toHaveValue(expectedPredecessorEnd);
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

test('blocks Kanban completion until the Definition of Done is complete', async ({ page }) => {
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
  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe bearbeiten' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Als erledigt markieren' })).toBeDisabled();
  await modal.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(notStarted.getByTestId('todo-card-tk-4')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'To-Dos' }).click();
  await expect(page.getByTestId('todo-column-not_started').getByTestId('todo-card-tk-4')).toBeVisible();
});
