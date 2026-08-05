import type { Task, TaskStatus } from '../types';

export const TASK_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'waiting',
  'completed',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Nicht gestartet',
  in_progress: 'In Bearbeitung',
  waiting: 'In Wartestellung',
  completed: 'Abgeschlossen',
};

export function deriveTaskStatus(progress: number): TaskStatus {
  if (progress >= 100) return 'completed';
  if (progress > 0) return 'in_progress';
  return 'not_started';
}

export function normalizeTaskStatus(status: unknown, progress: number): TaskStatus {
  return TASK_STATUSES.includes(status as TaskStatus)
    ? (status as TaskStatus)
    : deriveTaskStatus(progress);
}

/**
 * Keeps Kanban status and progress consistent. Completing a task always
 * means 100%; moving it back to an active column gives it a useful default
 * progress only when the old value cannot represent that state.
 */
export function patchForTaskStatus(
  task: Pick<Task, 'progress'>,
  status: TaskStatus,
): Pick<Task, 'status' | 'progress'> {
  if (status === 'completed') return { status, progress: 100 };
  if (status === 'not_started') return { status, progress: 0 };
  const progress = task.progress >= 100 ? 0 : task.progress;
  return { status, progress };
}

export function statusAfterProgressChange(currentStatus: TaskStatus, progress: number): TaskStatus {
  if (progress >= 100) return 'completed';
  if (currentStatus === 'waiting') return 'waiting';
  return deriveTaskStatus(progress);
}

export function normalizeTask<T extends Pick<Task, 'progress'> & { status?: unknown }>(
  task: T,
): T & { status: TaskStatus } {
  return { ...task, status: normalizeTaskStatus(task.status, task.progress) };
}
