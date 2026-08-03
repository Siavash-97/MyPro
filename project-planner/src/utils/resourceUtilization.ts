import type { Task } from '../types';
import { computeRange } from './layout';
import { hasChildren } from './hierarchy';
import { startOfMonth, addMonths } from './date';

/** One entry per calendar month spanning the whole plan's date range. Phase
 * (summary) tasks are excluded from the underlying counts everywhere in
 * this module -- only leaf tasks count, so a phase and its children aren't
 * both counted as "work" for the same person in the same month. */
export function computeMonthBuckets(tasks: Task[]): string[] {
  if (tasks.length === 0) return [];
  const { start, end } = computeRange(tasks);
  const months: string[] = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  while (cursor <= last) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function leafTasksForPersonMonth(tasks: Task[], personId: string, monthStart: string): Task[] {
  const monthEnd = addMonths(monthStart, 1); // exclusive upper bound
  return tasks.filter(
    (t) =>
      t.type === 'task' &&
      !hasChildren(tasks, t.id) &&
      t.assigneeIds.includes(personId) &&
      t.start < monthEnd &&
      t.end >= monthStart,
  );
}

export function utilizationCount(tasks: Task[], personId: string, monthStart: string): number {
  return leafTasksForPersonMonth(tasks, personId, monthStart).length;
}

/** The actual matching tasks for a cell, for a hover tooltip. */
export function tasksForCell(tasks: Task[], personId: string, monthStart: string): Task[] {
  return leafTasksForPersonMonth(tasks, personId, monthStart);
}
