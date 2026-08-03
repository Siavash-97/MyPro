import type { Task } from '../types';
import type { Rollup } from './hierarchy';
import { computeRollups, hasChildren } from './hierarchy';
import { diffDays, today } from './date';

function isTopLevel(tasks: Task[], t: Task): boolean {
  return !t.parentId || !tasks.some((p) => p.id === t.parentId);
}

/** Duration-weighted progress across top-level tasks (usually the phases),
 * so a whole phase counts proportionally to how long it runs rather than
 * every top-level item counting equally regardless of size. Mirrors
 * computeRollups' own weighting logic, just applied one level up (across
 * top-level tasks instead of across one parent's children). */
export function computeOverallProgress(tasks: Task[]): number {
  const rollups = computeRollups(tasks);
  const topLevel = tasks.filter((t) => t.type === 'task' && isTopLevel(tasks, t));
  if (topLevel.length === 0) return 0;
  let totalDuration = 0;
  let doneDuration = 0;
  for (const t of topLevel) {
    const r = rollups.get(t.id)!;
    const duration = Math.max(diffDays(r.start, r.end) + 1, 1);
    totalDuration += duration;
    doneDuration += duration * (r.progress / 100);
  }
  return totalDuration ? Math.round((doneDuration / totalDuration) * 100) : 0;
}

/** Every top-level phase (a top-level task with children), paired with its
 * rolled-up start/end/progress, soonest-starting first. */
export function computePhaseProgress(tasks: Task[]): { task: Task; rollup: Rollup }[] {
  const rollups = computeRollups(tasks);
  return tasks
    .filter((t) => t.type === 'task' && isTopLevel(tasks, t) && hasChildren(tasks, t.id))
    .map((t) => ({ task: t, rollup: rollups.get(t.id)! }))
    .sort((a, b) => (a.rollup.start < b.rollup.start ? -1 : a.rollup.start > b.rollup.start ? 1 : 0));
}

/** The soonest upcoming milestone (start >= today), or null if every
 * milestone is already in the past. */
export function nextMilestone(tasks: Task[]): Task | null {
  const t0 = today();
  const upcoming = tasks
    .filter((t) => t.type === 'milestone' && t.start >= t0)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  return upcoming[0] ?? null;
}

/** Same definition checkOverdueTasks itself uses (useProjectStore.ts):
 * a real task (not a milestone), not yet done, whose end date has passed. */
export function countOverdueTasks(tasks: Task[]): number {
  const t0 = today();
  return tasks.filter((t) => t.type === 'task' && t.progress < 100 && t.end < t0).length;
}
