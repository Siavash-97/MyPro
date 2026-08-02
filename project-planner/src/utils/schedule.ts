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

/**
 * Standard Critical Path Method over the current, already-scheduled dates:
 * a forward pass computes the earliest each task could start/finish given
 * its predecessors, a backward pass computes the latest it could start/
 * finish without pushing the overall project finish date out. Tasks where
 * earliest and latest start coincide have zero slack -- delaying any one
 * of them delays the whole project, which is exactly what "critical path"
 * means. Root tasks use their own actual start date as the forward-pass
 * baseline, since (unlike a from-scratch scheduling engine) our tasks
 * already carry real committed dates.
 */
export function computeCriticalPath(tasks: Task[], dependencies: Dependency[]): Set<string> {
  if (tasks.length === 0) return new Set();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));

  for (const d of dependencies) {
    if (!taskMap.has(d.fromId) || !taskMap.has(d.toId)) continue;
    if (!successors.has(d.fromId)) successors.set(d.fromId, []);
    successors.get(d.fromId)!.push(d.toId);
    if (!predecessors.has(d.toId)) predecessors.set(d.toId, []);
    predecessors.get(d.toId)!.push(d.fromId);
    indegree.set(d.toId, (indegree.get(d.toId) ?? 0) + 1);
  }

  // Topological order (Kahn's algorithm). If a cycle somehow exists, the
  // leftover tasks are appended as-is so this still returns a result
  // instead of throwing.
  const remaining = new Map(indegree);
  const order: string[] = tasks.filter((t) => remaining.get(t.id) === 0).map((t) => t.id);
  for (let i = 0; i < order.length; i++) {
    for (const succ of successors.get(order[i]) ?? []) {
      remaining.set(succ, (remaining.get(succ) ?? 0) - 1);
      if (remaining.get(succ) === 0) order.push(succ);
    }
  }
  if (order.length < tasks.length) {
    const seen = new Set(order);
    for (const t of tasks) if (!seen.has(t.id)) order.push(t.id);
  }

  const duration = (t: Task) => (t.type === 'milestone' ? 0 : diffDays(t.start, t.end));

  const earliestStart = new Map<string, string>();
  const earliestFinish = new Map<string, string>();
  for (const id of order) {
    const t = taskMap.get(id)!;
    let es = t.start;
    for (const p of predecessors.get(id) ?? []) {
      const candidate = addDays(earliestFinish.get(p) ?? t.start, 1);
      if (candidate > es) es = candidate;
    }
    earliestStart.set(id, es);
    earliestFinish.set(id, addDays(es, duration(t)));
  }

  let projectFinish = earliestFinish.get(order[0])!;
  for (const id of order) {
    const ef = earliestFinish.get(id)!;
    if (ef > projectFinish) projectFinish = ef;
  }

  const latestStart = new Map<string, string>();
  const latestFinish = new Map<string, string>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const t = taskMap.get(id)!;
    let lf = projectFinish;
    for (const s of successors.get(id) ?? []) {
      const candidate = addDays(latestStart.get(s) ?? projectFinish, -1);
      if (candidate < lf) lf = candidate;
    }
    latestFinish.set(id, lf);
    latestStart.set(id, addDays(lf, -duration(t)));
  }

  const critical = new Set<string>();
  for (const id of order) {
    if (earliestStart.get(id) === latestStart.get(id)) critical.add(id);
  }
  return critical;
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
