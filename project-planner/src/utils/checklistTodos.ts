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

export function filterChecklistTodosByPerson(
  todos: ChecklistTodoItem[],
  personId: string | null,
): ChecklistTodoItem[] {
  if (!personId) return todos;
  return todos.filter((todo) => todo.assigneeIds.includes(personId));
}
