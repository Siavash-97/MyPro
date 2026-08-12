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
  await expect(modal.getByText('Bitte mindestens eine Person zuweisen.')).toBeVisible();

  await modal.getByLabel('Vorgänger noch nicht bekannt').check();
  await modal.getByLabel('Nachfolger noch nicht bekannt').check();
  await startField.fill('');
  await modal.getByRole('button', { name: 'Speichern' }).click();
  await expect(modal.getByText('Bitte ein Startdatum eintragen.')).toBeVisible();

  await startField.fill(initialStart);
  await modal.getByRole('button', { name: 'Siavash', exact: true }).click();
  await modal.getByRole('button', { name: 'Speichern' }).click();

  await page.getByRole('button', { name: 'Zeitplan' }).click();
  const createdTask = page.getByText('Automatischer Browser-Test', { exact: true }).first();
  await expect(createdTask).toBeVisible();
  await createdTask.click();
  await expect(page.getByText('Aufgabe bearbeiten')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
});

test('allows a milestone without an assigned person', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Meilenstein' }).click();

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Meilenstein erstellen' });
  await modal.locator('label').filter({ hasText: /^Titel$/ }).locator('..').locator('input').fill('Meilenstein ohne Person');
  await modal.getByRole('button', { name: 'Speichern' }).click();

  await expect(modal).not.toBeVisible();
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

test('downloads the combined schedule and financial PDF report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zeitplan' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als PDF exportieren' }).click();
  const download = await downloadPromise;

  await expect(page.getByRole('button', { name: 'Als PDF exportieren' })).toBeEnabled();
  expect(download.suggestedFilename()).toMatch(/^myprosole-report-\d{4}-\d{2}-\d{2}\.pdf$/);
});

test('pans the timeline by click-and-drag, without creating a task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zeitplan' }).click();

  const scrollContainer = page.getByTestId('gantt-scroll-container');
  const grid = page.getByTestId('gantt-grid');
  const box = await grid.boundingBox();
  if (!box) throw new Error('grid has no bounding box');

  // computeRange pads the timeline with 7 empty days before the earliest
  // task, and 'day' zoom (the default) renders 44px/day -- box.x+20..150
  // lands well inside that guaranteed-empty run-up, never on a task bar,
  // and stays within the actual visible viewport (unlike box.width, which
  // is the full, often off-screen, scrollable timeline width).

  // An ordinary short click on empty grid creates a task, same as before
  // this change. Checked first, while still unscrolled: once the drag below
  // moves scrollLeft, this same spot near the grid's own left edge scrolls
  // underneath the sticky task-list sidebar and stops being clickable.
  await grid.click({ position: { x: 20, y: 20 } });
  await expect(page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  const startX = box.x + 150;
  const y = box.y + 20;
  const scrollBefore = await scrollContainer.evaluate((el) => el.scrollLeft);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 130, y, { steps: 10 });
  await page.mouse.up();

  const scrollAfter = await scrollContainer.evaluate((el) => el.scrollLeft);
  expect(scrollAfter).toBeGreaterThan(scrollBefore);

  // The drag must not also register as a click that creates a task.
  await expect(page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' })).not.toBeVisible();
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


test('reorders todos within a column by dragging onto another card, without changing their data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'To-Dos' }).click();

  const notStarted = page.getByTestId('todo-column-not_started');
  const orderIds = () =>
    notStarted.locator('[data-testid^="todo-card-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));

  // Natural (due-date) order has tk-7 before tk-9.
  const before = await orderIds();
  expect(before.indexOf('todo-card-tk-7')).toBeLessThan(before.indexOf('todo-card-tk-9'));

  const dragged = notStarted.getByTestId('todo-card-tk-9');
  const target = notStarted.getByTestId('todo-card-tk-7');
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error('target card has no bounding box');

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await dragged.dispatchEvent('dragstart', { dataTransfer });
  // Drop in the target's top half -> dragged card lands right before it.
  const dropPoint = { dataTransfer, clientY: targetBox.y + 5 };
  await target.dispatchEvent('dragover', dropPoint);
  await target.dispatchEvent('drop', dropPoint);
  await dragged.dispatchEvent('dragend', { dataTransfer });

  const after = await orderIds();
  expect(after.indexOf('todo-card-tk-9')).toBeLessThan(after.indexOf('todo-card-tk-7'));

  // The reorder is display-only: still "Nicht gestartet", not nudged into
  // another column or marked in progress by the drag itself.
  await expect(notStarted.getByTestId('todo-card-tk-9')).toBeVisible();
  await expect(page.getByTestId('todo-column-in_progress').getByTestId('todo-card-tk-9')).toHaveCount(0);

  // A real (if local-only) preference, not a one-off render fluke.
  await page.reload();
  await page.getByRole('button', { name: 'To-Dos' }).click();
  const afterReload = await orderIds();
  expect(afterReload.indexOf('todo-card-tk-9')).toBeLessThan(afterReload.indexOf('todo-card-tk-7'));
});


test('keeps a Kanban status set at 0% progress after an unrelated edit', async ({ page }) => {
  // Dragging a task straight from "Nicht gestartet" to "In Bearbeitung"
  // sets its status without touching progress (still 0%, see
  // patchForTaskStatus). Saving the edit dialog afterward always resends
  // the current progress even when only an unrelated field (here: notes)
  // was touched -- updateTask used to re-derive status from that resent
  // 0%, silently dropping the task back to "Nicht gestartet".
  await page.goto('/');
  await page.getByRole('button', { name: 'To-Dos' }).click();

  const notStarted = page.getByTestId('todo-column-not_started');
  const inProgress = page.getByTestId('todo-column-in_progress');
  const card = page.getByTestId('todo-card-tk-7');

  await expect(notStarted.getByTestId('todo-card-tk-7')).toBeVisible();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent('dragstart', { dataTransfer });
  await inProgress.dispatchEvent('dragover', { dataTransfer });
  await inProgress.dispatchEvent('drop', { dataTransfer });
  await card.dispatchEvent('dragend', { dataTransfer });
  await expect(inProgress.getByTestId('todo-card-tk-7')).toBeVisible();

  await inProgress.getByTestId('todo-card-tk-7').click();
  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe bearbeiten' });
  await expect(modal).toBeVisible();
  await modal.locator('textarea').fill('Kurze Notiz, unabhängig vom Fortschritt.');
  await modal.getByRole('button', { name: 'Speichern' }).click();
  await expect(modal).not.toBeVisible();

  await expect(inProgress.getByTestId('todo-card-tk-7')).toBeVisible();
  await expect(notStarted.getByTestId('todo-card-tk-7')).toHaveCount(0);

  // Survives a reload, i.e. the corrected status actually persisted.
  await page.reload();
  await page.getByRole('button', { name: 'To-Dos' }).click();
  await expect(page.getByTestId('todo-column-in_progress').getByTestId('todo-card-tk-7')).toBeVisible();
});
