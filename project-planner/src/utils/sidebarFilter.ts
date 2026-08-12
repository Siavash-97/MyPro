import type { Dependency, Task } from '../types';

export interface SidebarFilters {
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
}

/** Filters the task list shown in the sidebar/chart by title text and/or a
 * date range. When a task matches, its ancestor chain is kept too (even if
 * the ancestors themselves don't match) so the hierarchy stays readable
 * instead of showing orphaned children with no context. */
export function filterTasksBySidebar(tasks: Task[], filters: SidebarFilters): Task[] {
  const query = filters.search.trim().toLowerCase();
  const hasFilter = query !== '' || !!filters.dateFrom || !!filters.dateTo;
  if (!hasFilter) return tasks;

  const matchIds = new Set<string>();
  for (const t of tasks) {
    if (query && !t.title.toLowerCase().includes(query)) continue;
    if (filters.dateFrom && t.end < filters.dateFrom) continue;
    if (filters.dateTo && t.start > filters.dateTo) continue;
    matchIds.add(t.id);
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const keep = new Set<string>();
  for (const id of matchIds) {
    let cur: Task | undefined = byId.get(id);
    while (cur && !keep.has(cur.id)) {
      keep.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  return tasks.filter((t) => keep.has(t.id));
}

/** Hides tasks/milestones with no dependency at all -- kept are only those
 * that are a predecessor, a successor, or both. Same ancestor-keeping shape
 * as filterTasksBySidebar: a matching task's parent chain stays too, so a
 * connected child never ends up orphaned under a hidden summary task. */
export function filterTasksByConnection(tasks: Task[], dependencies: Dependency[], enabled: boolean): Task[] {
  if (!enabled) return tasks;

  const matchIds = new Set<string>();
  for (const dep of dependencies) {
    matchIds.add(dep.fromId);
    matchIds.add(dep.toId);
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const keep = new Set<string>();
  for (const id of matchIds) {
    let cur: Task | undefined = byId.get(id);
    while (cur && !keep.has(cur.id)) {
      keep.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  return tasks.filter((t) => keep.has(t.id));
}
