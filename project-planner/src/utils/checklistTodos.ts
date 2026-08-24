import type { Task } from '../types';

export interface ChecklistTodoItem {
  id: string;
  taskId: string;
  taskTitle: string;
  text: string;
  done: boolean;
  assigneeIds: string[];
}

/** Projects a task's checklist items into synthetic To-Do Kanban entries, so
 * a small step someone ticks off inside a task shows up as its own card
 * (Nicht gestartet -> Abgeschlossen) next to that task's assigned person,
 * without the checklist item becoming a real Task/Gantt row. */
export function buildChecklistTodos(
  items: Array<{ id: string; taskId: string; text: string; done: boolean }>,
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
      done: item.done,
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
