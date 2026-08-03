import type { Expense } from '../lib/expenses';
import type { Task } from '../types';

export const NOTABLE_THRESHOLD = 300;

export interface ComparisonRow {
  taskId: string;
  taskTitle: string;
  estimate: number;
  actual: number;
  /** null when only one side has data yet -- there's nothing meaningful to
   * compare until both an estimate and a real cost exist for the task. */
  delta: number | null;
  notable: boolean;
}

/** Groups expenses per task into estimate vs. actual sums, so the two can
 * be compared once real invoices start coming in alongside the AZA
 * cost-plan estimates. Sorted by the size of the deviation (biggest first),
 * so a real report highlights what most needs attention. */
export function computeExpenseComparison(expenses: Expense[], tasks: Task[]): ComparisonRow[] {
  const byTask = new Map<string, { estimate: number; actual: number }>();
  for (const e of expenses) {
    const entry = byTask.get(e.taskId) ?? { estimate: 0, actual: 0 };
    if (e.kind === 'estimate') entry.estimate += e.amount;
    else entry.actual += e.amount;
    byTask.set(e.taskId, entry);
  }

  const rows: ComparisonRow[] = [];
  for (const [taskId, { estimate, actual }] of byTask) {
    const task = tasks.find((t) => t.id === taskId);
    const delta = estimate > 0 && actual > 0 ? Math.round((actual - estimate) * 100) / 100 : null;
    rows.push({
      taskId,
      taskTitle: task?.title ?? '(gelöschte Aufgabe)',
      estimate: Math.round(estimate * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      delta,
      notable: delta !== null && Math.abs(delta) > NOTABLE_THRESHOLD,
    });
  }

  return rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
}
