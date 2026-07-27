import type { Person, Task } from '../types';
import { addDays, diffDays } from './date';

export const ROW_HEIGHT = 40;
export const GROUP_HEADER_HEIGHT = 30;

export type Row =
  | { kind: 'header'; id: string; label: string; color?: string; top: number }
  | { kind: 'task'; id: string; task: Task; top: number };

export function computeRange(tasks: Task[]): { start: string; end: string } {
  if (tasks.length === 0) {
    const t = new Date();
    return { start: addDays(t.toISOString().slice(0, 10), -7), end: addDays(t.toISOString().slice(0, 10), 30) };
  }
  let min = tasks[0].start;
  let max = tasks[0].end;
  for (const t of tasks) {
    if (t.start < min) min = t.start;
    if (t.end > max) max = t.end;
  }
  return { start: addDays(min, -7), end: addDays(max, 14) };
}

export function buildRows(
  tasks: Task[],
  people: Person[],
  swimlane: boolean,
  personFilter: string | null,
): Row[] {
  const filtered = personFilter
    ? tasks.filter((t) => t.assigneeIds.includes(personFilter))
    : tasks;

  const sorted = [...filtered].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const rows: Row[] = [];
  let top = 0;

  if (!swimlane) {
    for (const task of sorted) {
      rows.push({ kind: 'task', id: task.id, task, top });
      top += ROW_HEIGHT;
    }
    return rows;
  }

  const groups = new Map<string, Task[]>();
  const order: string[] = [];
  for (const p of people) {
    groups.set(p.id, []);
    order.push(p.id);
  }
  groups.set('__unassigned', []);
  order.push('__unassigned');

  for (const task of sorted) {
    const key = task.assigneeIds[0] ?? '__unassigned';
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(task);
  }

  for (const key of order) {
    const list = groups.get(key) ?? [];
    if (list.length === 0) continue;
    const person = people.find((p) => p.id === key);
    const label = key === '__unassigned' ? 'Nicht zugewiesen' : person?.name ?? 'Unbekannt';
    rows.push({ kind: 'header', id: `header-${key}`, label, color: person?.color, top });
    top += GROUP_HEADER_HEIGHT;
    for (const task of list) {
      rows.push({ kind: 'task', id: task.id, task, top });
      top += ROW_HEIGHT;
    }
  }

  return rows;
}

export function xForDate(rangeStart: string, iso: string, pxPerDay: number): number {
  return diffDays(rangeStart, iso) * pxPerDay;
}
