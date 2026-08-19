import { addMonthsKeepDay } from './date';
import type { Expense } from '../lib/expenses';

/** All occurrence dates of a subscription starting at `startIso`, stepping
 * every `intervalMonths` months, up to and including `throughIso`. Index 0
 * is always `startIso` itself. */
export function subscriptionOccurrenceDates(startIso: string, intervalMonths: number, throughIso: string): string[] {
  if (intervalMonths < 1) return [startIso];
  const dates: string[] = [];
  let n = 0;
  while (true) {
    const d = addMonthsKeepDay(startIso, n * intervalMonths);
    if (d > throughIso) break;
    dates.push(d);
    n += 1;
  }
  return dates;
}

/** Expands every subscription expense into one virtual occurrence per
 * elapsed period, up to today -- so a recurring cost simply shows up as
 * time passes, with no scheduled job writing rows in the background. Only
 * the original row is real (editable/deletable/has the invoice file); the
 * generated ones carry the same amount/description and a derived id so
 * every existing consumer (totals, exports, timeline) just sees more
 * `Expense`s without needing its own recurrence-aware logic. */
export function expandSubscriptions(expenses: Expense[], todayIso: string): Expense[] {
  const expanded: Expense[] = [];
  for (const expense of expenses) {
    expanded.push(expense);
    if (!expense.isSubscription || !expense.recurrenceIntervalMonths) continue;
    const dates = subscriptionOccurrenceDates(expense.expenseDate, expense.recurrenceIntervalMonths, todayIso);
    for (let i = 1; i < dates.length; i++) {
      expanded.push({
        ...expense,
        id: `${expense.id}::occ${i}`,
        expenseDate: dates[i],
        invoiceNumber: null,
        invoiceStoragePath: null,
        isVirtualOccurrence: true,
      });
    }
  }
  return expanded;
}
