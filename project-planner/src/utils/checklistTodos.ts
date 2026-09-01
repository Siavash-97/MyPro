import type { Task, TaskStatus } from '../types';

export interface ChecklistTodoItem {
  id: string;
  taskId: string;
  taskTitle: string;
  text: string;
  status: TaskStatus;
  assigneeIds: string[];
}

/** A checklist item only ever stores whether it's checked off (`done`) plus,
 * once the Kanban status column exists, a finer-grained status for the
 * unchecked case (not_started/in_progress/waiting). `done` stays the one
 * authoritative "is this finished" flag -- it always wins, so a stray or
 * stale `status` value can never show a checked item as still open. */
export function normalizeChecklistStatus(status: unknown, done: boolean): TaskStatus {
  if (done) return 'completed';
  if (status === 'in_progress' || status === 'waiting' || status === 'not_started') return status;
  return 'not_started';
}

/** Projects a task's checklist items into synthetic To-Do Kanban entries, so
 * a small step someone ticks off inside a task shows up as its own card
 * next to that task's assigned person, without the checklist item becoming
 * a real Task/Gantt row. */
export function buildChecklistTodos(
  items: Array<{ id: string; taskId: string; text: string; status: unknown; done: boolean }>,
  tasks: Task[],
): ChecklistTodoItem[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const result: ChecklistTodoItem[] = [];
  for (const item of items) {
    const task = taskById.get(item.taskId);
    if (!task || task.type !== 'task') continue;
    result.push({
      id: item.id,
      taskId: item.taskId,
      taskTitle: task.title,
      text: item.text,
      status: normalizeChecklistStatus(item.status, item.done),
      assigneeIds: task.assigneeIds,
    });
  }
  return result;
}

/** How far a task's checklist has gotten, as a task-editable `progress`
 * value -- never 100. Reaching 100/completed stays behind the Definition
 * of Done gate (completeTaskAfterDod), same as every other way `progress`
 * can move; a fully checked-off checklist only gets a task to 99%. `null`
 * means "no checklist items exist", so the caller leaves progress alone
 * instead of resetting it to 0 for a task that simply has no checklist. */
export function progressFromChecklist(done: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(99, Math.round((done / total) * 100));
}

export function summarizeChecklistByTask(
  items: Array<{ taskId: string; status: string }>,
): Record<string, { done: number; total: number }> {
  const summary: Record<string, { done: number; total: number }> = {};
  for (const item of items) {
    const entry = summary[item.taskId] ?? { done: 0, total: 0 };
    entry.total += 1;
    if (item.status === 'completed') entry.done += 1;
    summary[item.taskId] = entry;
  }
  return summary;
}

export function filterChecklistTodosByPerson(
  todos: ChecklistTodoItem[],
  personId: string | null,
): ChecklistTodoItem[] {
  if (!personId) return todos;
  return todos.filter((todo) => todo.assigneeIds.includes(personId));
}
