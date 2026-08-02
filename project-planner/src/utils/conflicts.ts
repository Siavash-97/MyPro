import type { Task } from '../types';

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Tasks assigned to the same person with overlapping date ranges: that
 * person can't actually do both at once, so both get flagged. Finished
 * tasks (progress 100) are ignored -- a completed task no longer competes
 * for anyone's time even if its dates happen to overlap another one. */
export function computeResourceConflicts(tasks: Task[]): Set<string> {
  const conflicted = new Set<string>();
  const byPerson = new Map<string, Task[]>();

  for (const t of tasks) {
    if (t.progress >= 100) continue;
    for (const personId of t.assigneeIds) {
      if (!byPerson.has(personId)) byPerson.set(personId, []);
      byPerson.get(personId)!.push(t);
    }
  }

  for (const list of byPerson.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (rangesOverlap(a.start, a.end, b.start, b.end)) {
          conflicted.add(a.id);
          conflicted.add(b.id);
        }
      }
    }
  }

  return conflicted;
}
