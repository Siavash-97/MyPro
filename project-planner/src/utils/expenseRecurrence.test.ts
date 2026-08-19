import { describe, expect, it } from 'vitest';
import type { Expense } from '../lib/expenses';
import { expandSubscriptions, subscriptionOccurrenceDates } from './expenseRecurrence';

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    taskId: 't1',
    description: 'Claude Max Abo',
    amount: 104.42,
    currency: 'EUR',
    kind: 'actual',
    invoiceNumber: 'INV-1',
    invoiceStoragePath: 'path/to/file.pdf',
    expenseDate: '2026-08-06',
    createdBy: 'Siavash',
    createdAt: '2026-08-06T10:00:00Z',
    isSubscription: false,
    recurrenceIntervalMonths: null,
    ...overrides,
  };
}

describe('subscriptionOccurrenceDates', () => {
  it('includes the start date as the first occurrence', () => {
    expect(subscriptionOccurrenceDates('2026-08-06', 1, '2026-08-06')).toEqual(['2026-08-06']);
  });

  it('steps monthly up to and including today', () => {
    expect(subscriptionOccurrenceDates('2026-08-06', 1, '2026-11-10')).toEqual([
      '2026-08-06',
      '2026-09-06',
      '2026-10-06',
      '2026-11-06',
    ]);
  });

  it('does not include a period that has not started yet', () => {
    expect(subscriptionOccurrenceDates('2026-08-06', 1, '2026-11-05')).toEqual([
      '2026-08-06',
      '2026-09-06',
      '2026-10-06',
    ]);
  });

  it('supports a custom multi-month interval', () => {
    expect(subscriptionOccurrenceDates('2026-01-01', 6, '2027-06-01')).toEqual([
      '2026-01-01',
      '2026-07-01',
      '2027-01-01',
    ]);
  });

  it('clamps a month-end start date instead of rolling into the next month', () => {
    expect(subscriptionOccurrenceDates('2026-01-31', 1, '2026-04-01')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });
});

describe('expandSubscriptions', () => {
  it('leaves a one-off expense untouched', () => {
    const result = expandSubscriptions([expense()], '2027-01-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('generates a virtual occurrence per elapsed period after the real row', () => {
    const result = expandSubscriptions(
      [expense({ isSubscription: true, recurrenceIntervalMonths: 1 })],
      '2026-10-20',
    );
    expect(result.map((e) => [e.id, e.expenseDate, e.isVirtualOccurrence ?? false])).toEqual([
      ['e1', '2026-08-06', false],
      ['e1::occ1', '2026-09-06', true],
      ['e1::occ2', '2026-10-06', true],
    ]);
  });

  it('does not carry the invoice onto generated occurrences', () => {
    const result = expandSubscriptions(
      [expense({ isSubscription: true, recurrenceIntervalMonths: 1 })],
      '2026-09-06',
    );
    const occurrence = result[1];
    expect(occurrence.invoiceNumber).toBeNull();
    expect(occurrence.invoiceStoragePath).toBeNull();
  });

  it('keeps the same amount and description on every occurrence', () => {
    const result = expandSubscriptions(
      [expense({ isSubscription: true, recurrenceIntervalMonths: 1, amount: 20 })],
      '2026-10-06',
    );
    expect(result.every((e) => e.amount === 20 && e.description === 'Claude Max Abo')).toBe(true);
  });
});
