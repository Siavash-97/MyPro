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
