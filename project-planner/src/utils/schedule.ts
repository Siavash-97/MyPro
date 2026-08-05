import type { Dependency, Task } from '../types';
import { addDays, diffDays } from './date';

/** The earliest a successor could start given one predecessor and the
 * dependency linking them, expressed as a date. All four relationship
 * types are reduced to a "minimum successor start" so applyCascade and
 * computeCriticalPath can share one formula: for Finish-to-Finish and
 * Start-to-Finish (which really constrain the successor's *end*), the
 * constraint is converted to an equivalent start using the successor's
 * own (fixed) duration. `lagDays` shifts the constraint further out
 * (positive = gap) or pulls it in (negative = overlap/lead time). */
function minSuccessorStart(
  predStart: string,
  predEnd: string,
  dep: Pick<Dependency, 'type' | 'lagDays'>,
  succDuration: number,
): string {
  const lag = dep.lagDays;
  switch (dep.type) {
    case 'FS':
      return addDays(predEnd, lag);
    case 'SS':
      return addDays(predStart, lag);
    case 'FF':
      return addDays(addDays(predEnd, lag), -succDuration);
    case 'SF':
      return addDays(addDays(predStart, lag), -succDuration);
  }
}

/** The mirror image of minSuccessorStart for the backward CPM pass: given
 * a successor's latest start/finish, the latest a predecessor could
 * finish without pushing the successor (and so the project) later.
 * Derived by solving each of minSuccessorStart's four cases for the
 * predecessor's finish date instead of the successor's start date. */
function maxPredecessorFinish(
  succLatestStart: string,
  succLatestFinish: string,
  dep: Pick<Dependency, 'type' | 'lagDays'>,
  predDuration: number,
): string {
  const lag = dep.lagDays;
  switch (dep.type) {
    case 'FS':
      return addDays(succLatestStart, -lag);
    case 'SS':
      return addDays(addDays(succLatestStart, -lag), predDuration);
    case 'FF':
      return addDays(succLatestFinish, -lag);
    case 'SF':
      return addDays(addDays(succLatestFinish, -lag), predDuration);
  }
}

/**
 * Forward-only auto-scheduling: if a predecessor's schedule runs into a
 * successor's required start (per their dependency type and lag), push
 * the successor -- and everything depending on it -- later by the same
 * number of days. Never pulls a successor earlier, only reacts to a
 * predecessor taking longer/starting later than planned.
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
      const succDuration = diffDays(succ.start, succ.end);
      const minStart = minSuccessorStart(pred.start, pred.end, dep, succDuration);
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

/** Changes one task's end and moves every still-open direct or transitive
 * successor by the same delta. Used both by daily overdue processing and by
 * early/late completion. */
export function rescheduleAfterTaskEndChange(
  tasks: Task[],
  dependencies: Dependency[],
  taskId: string,
  newEnd: string,
): Task[] {
  const source = tasks.find((task) => task.id === taskId);
  if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(newEnd)) return tasks;

  const deltaDays = diffDays(source.end, newEnd);
  const outgoing = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (!outgoing.has(dependency.fromId)) outgoing.set(dependency.fromId, []);
    outgoing.get(dependency.fromId)!.push(dependency.toId);
  }

  const successorIds = new Set<string>();
  const pending = [...(outgoing.get(taskId) ?? [])];
  while (pending.length > 0) {
    const successorId = pending.pop()!;
    if (successorIds.has(successorId)) continue;
    const successor = tasks.find((task) => task.id === successorId);
    if (!successor || successor.status === 'completed' || successor.progress >= 100) continue;
    successorIds.add(successorId);
    pending.push(...(outgoing.get(successorId) ?? []));
  }

  const shifted = tasks.map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        start: task.start > newEnd ? newEnd : task.start,
        end: newEnd,
      };
    }
    if (!successorIds.has(task.id) || deltaDays === 0) return task;
    return { ...task, start: addDays(task.start, deltaDays), end: addDays(task.end, deltaDays) };
  });

  return applyCascade(shifted, dependencies);
}

/** Finalises a task on its real completion date after the DoD gate passed. */
export function rescheduleAfterTaskCompletion(
  tasks: Task[],
  dependencies: Dependency[],
  taskId: string,
  completedOn: string,
): Task[] {
  return rescheduleAfterTaskEndChange(tasks, dependencies, taskId, completedOn).map((task) =>
    task.id === taskId ? { ...task, progress: 100, status: 'completed' as const } : task,
  );
}

/** Prefer the next direct open successor; otherwise use the next open task
 * in chronological order. */
export function nextOpenTaskId(tasks: Task[], dependencies: Dependency[], taskId: string): string | null {
  const current = tasks.find((task) => task.id === taskId);
  if (!current) return null;
  const isOpenTask = (task: Task) => task.type === 'task' && task.status !== 'completed' && task.progress < 100;
  const bySchedule = (a: Task, b: Task) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title);
  const directSuccessors = dependencies
    .filter((dependency) => dependency.fromId === taskId)
    .map((dependency) => tasks.find((task) => task.id === dependency.toId))
    .filter((task): task is Task => Boolean(task) && isOpenTask(task!))
    .sort(bySchedule);
  if (directSuccessors[0]) return directSuccessors[0].id;
  return tasks
    .filter((task) => task.id !== taskId && isOpenTask(task) && task.start >= current.start)
    .sort(bySchedule)[0]?.id ?? null;
}

/**
 * Standard Critical Path Method over the current, already-scheduled dates:
 * a forward pass computes the earliest each task could start/finish given
 * its predecessors (respecting each dependency's type and lag), a
 * backward pass computes the latest it could start/finish without pushing
 * the overall project finish date out. Tasks where earliest and latest
 * start coincide have zero slack -- delaying any one of them delays the
 * whole project, which is exactly what "critical path" means. Root tasks
 * use their own actual start date as the forward-pass baseline, since
 * (unlike a from-scratch scheduling engine) our tasks already carry real
 * committed dates.
 */
export function computeCriticalPath(tasks: Task[], dependencies: Dependency[]): Set<string> {
  if (tasks.length === 0) return new Set();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const predecessors = new Map<string, Dependency[]>();
  const successors = new Map<string, Dependency[]>();
  const indegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));

  for (const d of dependencies) {
    if (!taskMap.has(d.fromId) || !taskMap.has(d.toId)) continue;
    if (!successors.has(d.fromId)) successors.set(d.fromId, []);
    successors.get(d.fromId)!.push(d);
    if (!predecessors.has(d.toId)) predecessors.set(d.toId, []);
    predecessors.get(d.toId)!.push(d);
    indegree.set(d.toId, (indegree.get(d.toId) ?? 0) + 1);
  }

  // Topological order (Kahn's algorithm). If a cycle somehow exists, the
  // leftover tasks are appended as-is so this still returns a result
  // instead of throwing.
  const remaining = new Map(indegree);
  const order: string[] = tasks.filter((t) => remaining.get(t.id) === 0).map((t) => t.id);
  for (let i = 0; i < order.length; i++) {
    for (const dep of successors.get(order[i]) ?? []) {
      remaining.set(dep.toId, (remaining.get(dep.toId) ?? 0) - 1);
      if (remaining.get(dep.toId) === 0) order.push(dep.toId);
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
    const succDuration = duration(t);
    for (const dep of predecessors.get(id) ?? []) {
      const predStart = earliestStart.get(dep.fromId) ?? t.start;
      const predEnd = earliestFinish.get(dep.fromId) ?? t.start;
      const candidate = minSuccessorStart(predStart, predEnd, dep, succDuration);
      if (candidate > es) es = candidate;
    }
    earliestStart.set(id, es);
    earliestFinish.set(id, addDays(es, succDuration));
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
    const predDuration = duration(t);
    let lf = projectFinish;
    for (const dep of successors.get(id) ?? []) {
      const succLS = latestStart.get(dep.toId) ?? projectFinish;
      const succLF = latestFinish.get(dep.toId) ?? projectFinish;
      const candidate = maxPredecessorFinish(succLS, succLF, dep, predDuration);
      if (candidate < lf) lf = candidate;
    }
    latestFinish.set(id, lf);
    latestStart.set(id, addDays(lf, -predDuration));
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
