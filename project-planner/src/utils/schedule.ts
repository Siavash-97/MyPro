import type { Dependency, Task } from '../types';
import { addDays, diffDays } from './date';

/**
 * Forward-only auto-scheduling: if a predecessor's end date runs into a
 * successor's start date, push the successor (and everything depending on
 * it) later by the same number of days. Never pulls a successor earlier -
 * only reacts to a task taking longer than planned.
 * Relaxation is bounded to tasks.length passes, which also makes it safe
 * against accidental dependency cycles.
 */
export function applyCascade(tasks: Task[], dependencies: Dependency[]): Task[] {
  const map = new Map(tasks.map((t) => [t.id, { ...t }]));
  const maxPasses = tasks.length;

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const dep of dependencies) {
      const pred = map.get(dep.fromId);
      const succ = map.get(dep.toId);
      if (!pred || !succ) continue;
      const minStart = addDays(pred.end, 1);
      if (minStart > succ.start) {
        const shift = diffDays(succ.start, minStart);
        succ.start = addDays(succ.start, shift);
        succ.end = addDays(succ.end, shift);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return tasks.map((t) => map.get(t.id) ?? t);
}

/** True if adding fromId -> toId would close a cycle, i.e. toId can already
 * reach fromId through existing dependencies. Cycles would make forward
 * cascading push tasks further on every pass with no stable end state. */
export function wouldCreateCycle(dependencies: Dependency[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true;
  const outgoing = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!outgoing.has(dep.fromId)) outgoing.set(dep.fromId, []);
    outgoing.get(dep.fromId)!.push(dep.toId);
  }
  const visited = new Set<string>();
  const stack = [toId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === fromId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of outgoing.get(current) ?? []) stack.push(next);
  }
  return false;
}
