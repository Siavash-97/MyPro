import { describe, expect, it } from 'vitest';
import type { Expense } from '../lib/expenses';
import type { Task, WorkPackage } from '../types';
import { buildFinancialReport, computeProjectScheduleVariance } from './projectReport';

function task(id: string, end: string, workPackageId: string | null = null): Task {
  return {
    id,
    type: 'task',
    title: `Task ${id}`,
    start: '2026-01-01',
    end,
    assigneeIds: [],
    workPackageId,
    color: '#2563eb',
    progress: 0,
    status: 'not_started',
    notes: '',
    parentId: null,
  };
}

function expense(id: string, taskId: string, kind: Expense['kind'], amount: number, date: string): Expense {
  return {
    id,
    taskId,
    kind,
    amount,
    description: id,
    currency: 'EUR',
    invoiceNumber: null,
    invoiceStoragePath: null,
    expenseDate: date,
    createdBy: 'Test',
    createdAt: `${date}T10:00:00Z`,
  };
}

describe('project report schedule variance', () => {
  it('reports the overall delay against the latest baseline finish', () => {
    expect(
      computeProjectScheduleVariance(
        [task('one', '2026-01-12'), task('two', '2026-01-20')],
        { one: { start: '2026-01-01', end: '2026-01-10' }, two: { start: '2026-01-05', end: '2026-01-15' } },
      ),
    ).toEqual({ baselineEnd: '2026-01-15', currentEnd: '2026-01-20', varianceDays: 5, delayDays: 5 });
  });

  it('shows zero delay and a negative variance when the project is ahead', () => {
    expect(computeProjectScheduleVariance([task('one', '2026-01-07')], { one: { start: '2026-01-01', end: '2026-01-10' } }))
      .toEqual({ baselineEnd: '2026-01-10', currentEnd: '2026-01-07', varianceDays: -3, delayDays: 0 });
  });

  it('does not invent a delay when no baseline exists', () => {
    expect(computeProjectScheduleVariance([task('one', '2026-01-07')], {})).toEqual({
      baselineEnd: null,
      currentEnd: '2026-01-07',
      varianceDays: null,
      delayDays: null,
    });
  });
});

describe('project report finances', () => {
  it('aggregates estimated and real costs per work package and for the whole project', () => {
    const workPackages: WorkPackage[] = [
      { id: 'wp-2', name: 'Backend', color: '#000000' },
      { id: 'wp-1', name: 'App', color: '#000000' },
    ];
    const tasks = [task('one', '2026-01-10', 'wp-1'), task('two', '2026-01-20', 'wp-2')];
    const report = buildFinancialReport(
      [
        expense('estimate-app', 'one', 'estimate', 1000, '2026-01-01'),
        expense('actual-app', 'one', 'actual', 800, '2026-01-05'),
        expense('actual-backend', 'two', 'actual', 250.5, '2026-02-01'),
      ],
      tasks,
      workPackages,
    );

    expect(report).toMatchObject({ estimate: 1000, actual: 1050.5, delta: 50.5, expenseCount: 3 });
    expect(report.groups).toEqual([
      { id: 'wp-1', name: 'App', estimate: 1000, actual: 800, expenseCount: 2 },
      { id: 'wp-2', name: 'Backend', estimate: 0, actual: 250.5, expenseCount: 1 },
    ]);
    expect(report.expenses.map((row) => row.expense.id)).toEqual(['estimate-app', 'actual-app', 'actual-backend']);
  });
});
