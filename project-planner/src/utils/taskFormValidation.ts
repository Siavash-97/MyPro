import type { ItemType, Task } from '../types';
import { addDays, diffDays } from './date';

export interface TaskFormErrors {
  start?: string;
  end?: string;
  predecessor?: string;
  successor?: string;
  assignee?: string;
}

export function validateTaskForm(input: {
  type: ItemType;
  start: string;
  end: string;
  isSummary: boolean;
  hasPredecessor: boolean;
  hasSuccessor: boolean;
  predecessorUnknown: boolean;
  successorUnknown: boolean;
  assigneeCount: number;
}): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (!input.isSummary && !input.start) errors.start = 'Bitte ein Startdatum eintragen.';
  if (!input.isSummary && input.type === 'task' && !input.end) errors.end = 'Bitte ein Enddatum eintragen.';
  if (!input.isSummary && input.start && input.end && input.end < input.start) {
    errors.end = 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  }
  if (input.type === 'task' && !input.isSummary) {
    if (!input.hasPredecessor && !input.predecessorUnknown) {
      errors.predecessor = 'Bitte einen Vorgänger wählen oder „Vorgänger noch nicht bekannt“ markieren.';
    }
    if (!input.hasSuccessor && !input.successorUnknown) {
      errors.successor = 'Bitte einen Nachfolger wählen oder „Nachfolger noch nicht bekannt“ markieren.';
    }
  }
  if (input.type === 'task' && input.assigneeCount < 1) {
    errors.assignee = 'Bitte mindestens eine Person zuweisen.';
  }
  return errors;
}

/** Preserves the entered duration while anchoring the task to the exact
 * finish date of its latest predecessor. */
export function datesFromPredecessor(
  currentStart: string,
  currentEnd: string,
  predecessorEnd: string,
): { start: string; end: string } {
  const duration = currentStart && currentEnd && currentEnd >= currentStart
    ? diffDays(currentStart, currentEnd)
    : 0;
  return { start: predecessorEnd, end: addDays(predecessorEnd, duration) };
}

export function latestTaskEnd(tasks: Pick<Task, 'end'>[]): string | null {
  if (tasks.length === 0) return null;
  return tasks.reduce((latest, task) => task.end > latest ? task.end : latest, tasks[0].end);
}
