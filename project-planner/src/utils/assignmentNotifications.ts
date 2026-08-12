import type { Person } from '../types';
import { queueAssignmentNotification } from '../lib/db';

/** People newly present in nextIds (not previousIds) who actually opted
 * into assignment e-mails and have an address to send one to -- the set
 * it's worth asking about at all. Re-saving with the same assignees, or
 * removing someone, never asks (nothing "newly" happened to them). */
export function notifiableNewAssignees(previousIds: string[], nextIds: string[], people: Person[]): Person[] {
  const addedIds = nextIds.filter((id) => !previousIds.includes(id));
  return addedIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p && (p.notify_on_assignment ?? true) && !!p.email);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/** Asks once (native confirm) before queueing an assignment e-mail for each
 * newly-assigned, notifiable person -- shared by every place a task's
 * assignees can change (the edit modal's save, and the Gantt sidebar's
 * drag-to-reassign), so nobody gets silently e-mailed. */
export async function confirmAndQueueAssignmentNotifications(taskId: string, candidates: Person[]): Promise<void> {
  if (candidates.length === 0) return;
  const label = joinNames(candidates.map((p) => p.name));
  if (!confirm(`${label} per E-Mail über die Zuweisung benachrichtigen?`)) return;
  await Promise.all(candidates.map((p) => queueAssignmentNotification(taskId, p.id)));
}
