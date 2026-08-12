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

export type SidebarSort = 'start' | 'title';

/** While a task is actively being dragged (moved or resized from the left),
 * its start date changes continuously -- sorting rows by the live value
 * would flip row order mid-drag the instant it crosses or ties another
 * task's start, making the bar jump to a different row while the user is
 * still holding the mouse down. Freezing the dragged task's sort key at
 * whatever its start was when the drag began keeps row order stable for the
 * whole gesture; the bar itself still moves smoothly since its on-screen
 * position is computed separately from the live task data, not from this. */
export interface DragSortOverride {
  taskId: string;
  start: string;
}

function sortStartFor(task: Task, dragOverride?: DragSortOverride | null): string {
  return dragOverride && task.id === dragOverride.taskId ? dragOverride.start : task.start;
}

function compareTasks(a: Task, b: Task, sortBy: SidebarSort, dragOverride?: DragSortOverride | null): number {
  if (sortBy === 'title') return a.title.localeCompare(b.title, 'de');
  const aStart = sortStartFor(a, dragOverride);
  const bStart = sortStartFor(b, dragOverride);
  return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
}

/** Applies a persisted manual row order on top of an already
 * date/title-sorted list: ids present in `order` keep exactly that relative
 * order; any id missing from it (a new task, or before the user has ever
 * dragged in the sidebar) falls back to its natural sorted position,
 * relative to the other not-yet-ordered ids only -- it never jumps in front
 * of something the user explicitly placed. This is what keeps a task's row
 * stable once arranged: row order stops being a live function of task.start
 * and instead only changes when the sidebar drag explicitly says so. */
function applyManualOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return ordered;
}

/** Depth-first parent-then-children order (siblings sorted by start date or
 * title), used by the flat (non-swimlane) view so a Work Breakdown Structure
 * reads as an indented outline instead of everything sorted globally by
 * date. Only applied here -- combining this with swimlane's group-by-person
 * view would be ambiguous whenever a child's assignee differs from its
 * parent's, so swimlane mode keeps its existing flat per-person sort. */
function hierarchyOrder(
  tasks: Task[],
  collapsedIds: Set<string>,
  sortBy: SidebarSort,
  dragOverride?: DragSortOverride | null,
  manualOrder: string[] = [],
): { task: Task; indent: number }[] {
  const byParent = new Map<string | null, Task[]>();
  const validIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    const key = t.parentId && validIds.has(t.parentId) ? t.parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  for (const [key, list] of byParent) {
    list.sort((a, b) => compareTasks(a, b, sortBy, dragOverride));
    byParent.set(key, applyManualOrder(list, manualOrder));
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
  sortBy: SidebarSort = 'start',
  dragOverride: DragSortOverride | null = null,
  manualOrder: string[] = [],
): Row[] {
  const filtered = personFilter
    ? tasks.filter((t) => t.assigneeIds.includes(personFilter))
    : tasks;

  const rows: Row[] = [];
  let top = 0;

  if (!swimlane) {
    for (const { task, indent } of hierarchyOrder(filtered, collapsedIds, sortBy, dragOverride, manualOrder)) {
      rows.push({ kind: 'task', id: task.id, task, top, indent, hasChildren: tasks.some((t) => t.parentId === task.id) });
      top += ROW_HEIGHT;
    }
    return rows;
  }

  const sorted = [...filtered].sort((a, b) => compareTasks(a, b, sortBy, dragOverride));

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
    const list = applyManualOrder(groups.get(key) ?? [], manualOrder);
    if (list.length === 0) continue;
    const person = people.find((p) => p.id === key);
    const label = key === '__unassigned' ? 'Nicht zugewiesen' : person?.name ?? 'Unbekannt';
    const headerId = `header-${key}`;
    rows.push({
      kind: 'header',
      id: headerId,
      label,
      color: person?.color,
      personId: key === '__unassigned' ? undefined : key,
      top,
    });
    top += GROUP_HEADER_HEIGHT;
    if (collapsedIds.has(headerId)) continue;
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
