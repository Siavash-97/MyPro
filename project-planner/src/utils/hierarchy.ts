import type { Task } from '../types';
import { diffDays } from './date';

export interface Rollup {
  start: string;
  end: string;
  progress: number;
}

/** A task with children is a "summary task": its displayed dates and
 * progress come from its children (min start, max end, duration-weighted
 * average progress) instead of being edited directly. Computed fresh from
 * the task list rather than stored, so it's always consistent with
 * whatever the children currently say -- there's nothing to keep in sync.
 * Recursive for multi-level hierarchies (a summary task can itself be a
 * child of another summary task), with a visiting-guard so a data
 * inconsistency (an accidental cycle) can't hang the UI. */
export function computeRollups(tasks: Task[]): Map<string, Rollup> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const childrenMap = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parentId && taskMap.has(t.parentId)) {
      if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
      childrenMap.get(t.parentId)!.push(t);
    }
  }

  const result = new Map<string, Rollup>();
  const visiting = new Set<string>();

  function resolve(id: string): Rollup {
    const cached = result.get(id);
    if (cached) return cached;
    const self = taskMap.get(id)!;
    const children = childrenMap.get(id);
    if (!children || children.length === 0 || visiting.has(id)) {
      const own = { start: self.start, end: self.end, progress: self.progress };
      result.set(id, own);
      return own;
    }
    visiting.add(id);
    let start = '';
    let end = '';
    let totalDuration = 0;
    let doneDuration = 0;
    for (const child of children) {
      const r = resolve(child.id);
      if (!start || r.start < start) start = r.start;
      if (!end || r.end > end) end = r.end;
      const duration = Math.max(diffDays(r.start, r.end) + 1, 1);
      totalDuration += duration;
      doneDuration += duration * (r.progress / 100);
    }
    visiting.delete(id);
    const rollup: Rollup = {
      start,
      end,
      progress: totalDuration ? Math.round((doneDuration / totalDuration) * 100) : 0,
    };
    result.set(id, rollup);
    return rollup;
  }

  for (const t of tasks) resolve(t.id);
  return result;
}

export function hasChildren(tasks: Task[], id: string): boolean {
  return tasks.some((t) => t.parentId === id);
}

/** ids of every task reachable by following parentId links down from id
 * (its children, grandchildren, ...) -- used to stop a task from being
 * assigned as its own descendant's parent, which would create a cycle
 * that computeRollups can't meaningfully resolve. */
export function getDescendantIds(tasks: Task[], id: string): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentId) {
      if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
      childrenMap.get(t.parentId)!.push(t.id);
    }
  }
  const result = new Set<string>();
  const stack = [...(childrenMap.get(id) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(childrenMap.get(current) ?? []));
  }
  return result;
}
