import type { Expense } from '../lib/expenses';
import type { BaselineEntry } from '../lib/db';
import type { Task, WorkPackage } from '../types';
import { diffDays, parseISO, toISO } from './date';

export interface ProjectScheduleVariance {
  baselineEnd: string | null;
  currentEnd: string | null;
  /** Positive means late, negative means ahead of the stored baseline. */
  varianceDays: number | null;
  /** The user-facing delay never becomes negative. */
  delayDays: number | null;
}

export interface FinancialReportGroup {
  id: string;
  name: string;
  estimate: number;
  actual: number;
  expenseCount: number;
}

export interface FinancialReportExpense {
  expense: Expense;
  taskTitle: string;
  workPackageName: string;
}

export interface FinancialReport {
  estimate: number;
  actual: number;
  delta: number;
  expenseCount: number;
  groups: FinancialReportGroup[];
  expenses: FinancialReportExpense[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNASSIGNED_GROUP_ID = '__unassigned__';

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  return toISO(parseISO(value)) === value;
}

function latestValidDate(values: string[]): string | null {
  const valid = values.filter(isValidIsoDate);
  return valid.length ? valid.sort().at(-1) ?? null : null;
}

/** Compares the current overall project finish with the last stored baseline.
 * New tasks are included in the current finish; deleted baseline tasks remain
 * part of the committed reference finish until a new baseline is saved. */
export function computeProjectScheduleVariance(
  tasks: Task[],
  baseline: Record<string, BaselineEntry>,
): ProjectScheduleVariance {
  const currentEnd = latestValidDate(tasks.map((task) => task.end));
  const baselineEnd = latestValidDate(Object.values(baseline).map((entry) => entry.end));
  if (!currentEnd || !baselineEnd) {
    return { baselineEnd, currentEnd, varianceDays: null, delayDays: null };
  }

  const varianceDays = diffDays(baselineEnd, currentEnd);
  return {
    baselineEnd,
    currentEnd,
    varianceDays,
    delayDays: Math.max(varianceDays, 0),
  };
}

function roundedCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Builds one normalized financial view for PDF presentation. Report drawing
 * stays separate, so the aggregation remains independently unit-testable. */
export function buildFinancialReport(
  expenses: Expense[],
  tasks: Task[],
  workPackages: WorkPackage[],
): FinancialReport {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const workPackagesById = new Map(workPackages.map((workPackage) => [workPackage.id, workPackage]));
  const groupMap = new Map<string, FinancialReportGroup>();
  let estimate = 0;
  let actual = 0;

  const detailedExpenses = expenses.map((expense) => {
    const amount = Number.isFinite(expense.amount) ? expense.amount : 0;
    const task = tasksById.get(expense.taskId);
    const workPackage = task?.workPackageId ? workPackagesById.get(task.workPackageId) : undefined;
    const groupId = workPackage?.id ?? UNASSIGNED_GROUP_ID;
    const group = groupMap.get(groupId) ?? {
      id: groupId,
      name: workPackage?.name ?? 'Ohne Arbeitspaket',
      estimate: 0,
      actual: 0,
      expenseCount: 0,
    };

    if (expense.kind === 'estimate') {
      estimate += amount;
      group.estimate += amount;
    } else {
      actual += amount;
      group.actual += amount;
    }
    group.expenseCount += 1;
    groupMap.set(groupId, group);

    return {
      expense,
      taskTitle: task?.title ?? '(gelöschte Aufgabe)',
      workPackageName: workPackage?.name ?? 'Ohne Arbeitspaket',
    };
  });

  const groups = [...groupMap.values()]
    .map((group) => ({
      ...group,
      estimate: roundedCurrency(group.estimate),
      actual: roundedCurrency(group.actual),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  estimate = roundedCurrency(estimate);
  actual = roundedCurrency(actual);
  return {
    estimate,
    actual,
    delta: roundedCurrency(actual - estimate),
    expenseCount: expenses.length,
    groups,
    expenses: detailedExpenses.sort(
      (a, b) =>
        a.expense.expenseDate.localeCompare(b.expense.expenseDate) ||
        a.expense.createdAt.localeCompare(b.expense.createdAt),
    ),
  };
}
