import { describe, expect, it } from 'vitest';
import type { Expense } from '../lib/expenses';
import { buildExpenseTimeline } from './expenseTimeline';

function expense(id: string, expenseDate: string, amount: number, kind: Expense['kind']): Expense {
  return {
    id,
    taskId: 'task-1',
    description: id,
    amount,
    currency: 'EUR',
    kind,
    invoiceNumber: null,
    invoiceStoragePath: null,
    expenseDate,
    createdBy: 'Test',
    createdAt: `${expenseDate}T12:00:00Z`,
  };
}

describe('expense timeline', () => {
  it('groups and totals expenses by year and month in newest-first order', () => {
    const timeline = buildExpenseTimeline([
      expense('july-estimate', '2026-07-03', 100, 'estimate'),
      expense('july-actual', '2026-07-19', 40, 'actual'),
      expense('december-actual', '2026-12-02', 60, 'actual'),
      expense('older', '2025-11-10', 25, 'actual'),
    ]);

    expect(timeline.map((group) => group.year)).toEqual(['2026', '2025']);
    expect(timeline[0]).toMatchObject({ estimate: 100, actual: 100, expenseCount: 3 });
    expect(timeline[0].months.map((month) => month.key)).toEqual(['2026-12', '2026-07']);
    expect(timeline[0].months[1]).toMatchObject({ label: 'Juli', estimate: 100, actual: 40 });
    expect(timeline[0].months[1].expenses.map((item) => item.id)).toEqual(['july-actual', 'july-estimate']);
  });
});
