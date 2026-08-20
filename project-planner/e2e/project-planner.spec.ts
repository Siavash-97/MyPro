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

test('asks before e-mailing a newly assigned person, only when they can actually be notified', async ({ page }) => {
  await page.goto('/');

  // Give Siavash an e-mail address so they become notify-eligible (people
  // without one, or who opted out, must never trigger the prompt at all).
  await page.getByRole('button', { name: 'Personen/AP verwalten' }).click();
  const panel = page.locator('.fixed.inset-0').filter({ hasText: 'Personen & Arbeitspakete' });
  await panel.getByText('Siavash').locator('..').getByRole('button', { name: 'Benachrichtigungen' }).click();
  await panel.getByPlaceholder('name@myprosole.de').fill('siavash@example.com');
  await panel.getByPlaceholder('name@myprosole.de').blur();
  await panel.locator('button', { hasText: '×' }).click();

  await page.getByRole('button', { name: '+ Aufgabe' }).click();
  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' });
  await modal.locator('label').filter({ hasText: /^Titel$/ }).locator('..').locator('input').fill('Benachrichtigungs-Test');
  await modal.getByLabel('Vorgänger noch nicht bekannt').check();
  await modal.getByLabel('Nachfolger noch nicht bekannt').check();

  // Assigning Bastian (no e-mail on file) must not trigger anything. A
  // *named* handler, explicitly removed right after -- page.once() only
  // unregisters itself once it actually fires, so a handler set up for "no
  // dialog expected here" would otherwise sit there and steal the next
  // phase's dialog instead of leaving it for that phase's own handler.
  let dialogSeen = false;
  const noDialogExpected = (dialog: import('@playwright/test').Dialog) => { dialogSeen = true; void dialog.dismiss(); };
  page.on('dialog', noDialogExpected);
  await modal.getByRole('button', { name: 'Bastian', exact: true }).click();
  await modal.getByRole('button', { name: 'Speichern' }).click();
  await expect(modal).not.toBeVisible();
  page.off('dialog', noDialogExpected);
  expect(dialogSeen, 'no dialog for a person without an e-mail address').toBe(false);

  // Saving returns to whichever view was active before the dialog opened
  // (here: Übersicht, where the task title isn't shown at all) -- switch to
  // Zeitplan to find and reopen it.
  await page.getByRole('button', { name: 'Zeitplan' }).click();

  // Now assign the notify-eligible Siavash to the same task and confirm.
  await page.getByText('Benachrichtigungs-Test', { exact: true }).first().click();
  const editModal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe bearbeiten' });
  await expect(editModal).toBeVisible();

  let confirmedMessage: string | null = null;
  page.once('dialog', (dialog) => {
    confirmedMessage = dialog.message();
    void dialog.accept();
  });
  await editModal.getByRole('button', { name: 'Siavash', exact: true }).click();
  await editModal.getByRole('button', { name: 'Speichern' }).click();
  await expect(editModal).not.toBeVisible();
  expect(confirmedMessage).toBe('Siavash per E-Mail über die Zuweisung benachrichtigen?');

  // Re-saving with the same assignees (nothing "newly" assigned) asks nothing.
  await page.getByText('Benachrichtigungs-Test', { exact: true }).first().click();
  await expect(editModal).toBeVisible();
  let secondDialogSeen = false;
  const noDialogExpectedAgain = (dialog: import('@playwright/test').Dialog) => { secondDialogSeen = true; void dialog.dismiss(); };
  page.on('dialog', noDialogExpectedAgain);
  await editModal.getByRole('button', { name: 'Speichern' }).click();
  await expect(editModal).not.toBeVisible();
  page.off('dialog', noDialogExpectedAgain);
  expect(secondDialogSeen, 'no dialog when assignees did not change').toBe(false);
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


test('lists predecessor and successor candidates alphabetically', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Aufgabe' }).click();

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' });
  // First <option> in each is the "+ ... hinzufügen…" placeholder, not a
  // real candidate -- skip it before checking sort order.
  const predecessorTitles = await modal.getByLabel('Vorgänger hinzufügen').locator('option').allTextContents();
  const successorTitles = await modal.getByLabel('Nachfolger hinzufügen').locator('option').allTextContents();

  const sortedDe = (titles: string[]) => [...titles].sort((a, b) => a.localeCompare(b, 'de'));
  expect(predecessorTitles.slice(1)).toEqual(sortedDe(predecessorTitles.slice(1)));
  expect(successorTitles.slice(1)).toEqual(sortedDe(successorTitles.slice(1)));
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


test('hides tasks with no dependency at all when "Nur verbundene Aufgaben" is on', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Aufgabe' }).click();

  // Same recipe as the very first test in this file: checking both
  // "noch nicht bekannt" boxes creates a task with zero dependency rows,
  // i.e. genuinely disconnected -- exactly the case this filter targets.
  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe erstellen' });
  await modal.locator('label').filter({ hasText: /^Titel$/ }).locator('..').locator('input').fill('Ohne jede Abhängigkeit');
  await modal.getByLabel('Vorgänger noch nicht bekannt').check();
  await modal.getByLabel('Nachfolger noch nicht bekannt').check();
  await modal.getByRole('button', { name: 'Siavash', exact: true }).click();
  await modal.getByRole('button', { name: 'Speichern' }).click();

  await page.getByRole('button', { name: 'Zeitplan' }).click();
  // The title renders twice on this view -- once in the sidebar row, once
  // as the inline label on its own task bar -- so match by count, not a
  // single element.
  const disconnected = page.getByText('Ohne jede Abhängigkeit', { exact: true });
  const connected = page.getByText('Sensor-Auswahl & Beschaffung', { exact: true }).first();
  await expect(disconnected.first()).toBeVisible();
  await expect(connected).toBeVisible();

  await page.getByText('Nur verbundene Aufgaben').click();
  await expect(disconnected).toHaveCount(0);
  await expect(connected).toBeVisible();

  await page.getByText('Nur verbundene Aufgaben').click();
  await expect(disconnected.first()).toBeVisible();
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

test('a task row never changes position just because its date changed', async ({ page }) => {
  // tk-1 (start -10d) naturally sorts before tk-3 (start -5d). Moving tk-1's
  // date well past tk-3's used to flip their sidebar/row order live, every
  // render -- the exact "bar slides to another row" bug this fix targets.
  // The row must stay put once seeded; only an explicit sidebar drag may
  // move it.
  await page.goto('/');
  await page.getByRole('button', { name: 'Zeitplan' }).click();

  const rowOrder = () =>
    page.locator('[data-testid^="gantt-row-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));

  const before = await rowOrder();
  expect(before.indexOf('gantt-row-tk-1')).toBeLessThan(before.indexOf('gantt-row-tk-3'));

  // tk-1's seeded end date is today-2d, so the new start must stay at or
  // before that (today-3d) to keep the form valid without also touching the
  // end field -- while still landing after tk-3's start (today-5d), which
  // is the crossing this test needs.
  const newStart = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 3);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  await page.getByTestId('gantt-row-tk-1').click();
  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe bearbeiten' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Startdatum').fill(newStart);
  await modal.getByRole('button', { name: 'Speichern' }).click();
  await expect(modal).not.toBeVisible();

  // The date change actually happened (proving the row-order check below
  // isn't just passing because nothing moved) -- tk-1 now starts after tk-3.
  await page.getByTestId('gantt-row-tk-1').click();
  await expect(modal.getByLabel('Startdatum')).toHaveValue(newStart);
  await modal.getByRole('button', { name: 'Abbrechen' }).click();

  const after = await rowOrder();
  expect(after.indexOf('gantt-row-tk-1')).toBeLessThan(after.indexOf('gantt-row-tk-3'));
});

test('sidebar drag within a swimlane does not change its strict date order, but crossing lanes reassigns the task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zeitplan' }).click();
  await page.getByText('Swimlanes (nach Person)').click();

  const rowOrder = () =>
    page.locator('[data-testid^="gantt-row-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));

  // tk-3 and tk-9 are both in Siavash's group, naturally sorted tk-3 before
  // tk-9 (start -5d vs +43d).
  const before = await rowOrder();
  expect(before.indexOf('gantt-row-tk-3')).toBeLessThan(before.indexOf('gantt-row-tk-9'));

  const dragged = page.getByTestId('gantt-row-tk-9');
  const target = page.getByTestId('gantt-row-tk-3');
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error('target row has no bounding box');

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await dragged.dispatchEvent('dragstart', { dataTransfer });
  const dropPoint = { dataTransfer, clientY: targetBox.y + 5 };
  await target.dispatchEvent('dragover', dropPoint);
  await target.dispatchEvent('drop', dropPoint);
  await dragged.dispatchEvent('dragend', { dataTransfer });

  // A swimlane is always strictly date-sorted -- dragging tk-9 onto tk-3
  // (both Siavash's) has no lasting effect on their order.
  const afterDrop = await rowOrder();
  expect(afterDrop.indexOf('gantt-row-tk-3')).toBeLessThan(afterDrop.indexOf('gantt-row-tk-9'));

  await page.reload();
  await page.getByRole('button', { name: 'Zeitplan' }).click();
  const afterReload = await rowOrder();
  expect(afterReload.indexOf('gantt-row-tk-3')).toBeLessThan(afterReload.indexOf('gantt-row-tk-9'));

  // Dragging tk-3 onto Bastian's tk-6 crosses a swimlane boundary: tk-3
  // must be reassigned to Bastian (its only person, previously Siavash).
  // Bastian has no e-mail on file in the seed data, so this must not pop a
  // notification confirm dialog -- verified by simply not handling one; an
  // unexpected dialog would otherwise hang the test until timeout.
  const draggedCross = page.getByTestId('gantt-row-tk-3');
  const targetCross = page.getByTestId('gantt-row-tk-6');
  const dt2 = await page.evaluateHandle(() => new DataTransfer());
  await draggedCross.dispatchEvent('dragstart', { dataTransfer: dt2 });
  await targetCross.dispatchEvent('dragover', { dataTransfer: dt2 });
  await targetCross.dispatchEvent('drop', { dataTransfer: dt2 });
  await draggedCross.dispatchEvent('dragend', { dataTransfer: dt2 });

  await page.getByTestId('gantt-row-tk-3').click();
  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Aufgabe bearbeiten' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Bastian', exact: true })).toHaveClass(/border-transparent/);
  await expect(modal.getByRole('button', { name: 'Siavash', exact: true })).not.toHaveClass(/border-transparent/);
});
