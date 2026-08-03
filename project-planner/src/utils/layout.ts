import type { Person, Task } from '../types';
import { addDays, diffDays } from './date';

export const ROW_HEIGHT = 40;
export const GROUP_HEADER_HEIGHT = 30;

export type Row =
  | { kind: 'header'; id: string; label: string; color?: string; personId?: string; top: number }
  | { kind: 'task'; id: string; task: Task; top: number; indent: number; hasChildren: boolean };

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

/** Depth-first parent-then-children order (siblings sorted by start date),
 * used by the flat (non-swimlane) view so a Work Breakdown Structure reads
 * as an indented outline instead of everything sorted globally by date.
 * Only applied here -- combining this with swimlane's group-by-person view
 * would be ambiguous whenever a child's assignee differs from its parent's,
 * so swimlane mode keeps its existing flat per-person sort. */
function hierarchyOrder(tasks: Task[], collapsedIds: Set<string>): { task: Task; indent: number }[] {
  const byParent = new Map<string | null, Task[]>();
  const validIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    const key = t.parentId && validIds.has(t.parentId) ? t.parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  }

  const order: { task: Task; indent: number }[] = [];
  function walk(parentKey: string | null, indent: number) {
    for (const t of byParent.get(parentKey) ?? []) {
      order.push({ task: t, indent });
      if (!collapsedIds.has(t.id)) walk(t.id, indent + 1);
    }
  }
  walk(null, 0);
  return order;
}

export function buildRows(
  tasks: Task[],
  people: Person[],
  swimlane: boolean,
  personFilter: string | null,
  collapsedIds: Set<string> = new Set(),
): Row[] {
  const filtered = personFilter
    ? tasks.filter((t) => t.assigneeIds.includes(personFilter))
    : tasks;

  const rows: Row[] = [];
  let top = 0;

  if (!swimlane) {
    for (const { task, indent } of hierarchyOrder(filtered, collapsedIds)) {
      rows.push({ kind: 'task', id: task.id, task, top, indent, hasChildren: tasks.some((t) => t.parentId === task.id) });
      top += ROW_HEIGHT;
    }
    return rows;
  }

  const sorted = [...filtered].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

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
    rows.push({
      kind: 'header',
      id: `header-${key}`,
      label,
      color: person?.color,
      personId: key === '__unassigned' ? undefined : key,
      top,
    });
    top += GROUP_HEADER_HEIGHT;
    for (const task of list) {
      rows.push({ kind: 'task', id: task.id, task, top, indent: 0, hasChildren: false });
      top += ROW_HEIGHT;
    }
  }

  return rows;
}

export function xForDate(rangeStart: string, iso: string, pxPerDay: number): number {
  return diffDays(rangeStart, iso) * pxPerDay;
}

/** In swimlane mode, which person's group a given y-coordinate falls into
 * (walks back to the nearest preceding group header). Undefined outside a
 * group, in the "unassigned" group, or when swimlanes are off. */
export function personIdAtY(rows: Row[], y: number): string | undefined {
  let current: string | undefined;
  for (const row of rows) {
    if (row.top > y) break;
    if (row.kind === 'header') current = row.personId;
  }
  return current;
}
