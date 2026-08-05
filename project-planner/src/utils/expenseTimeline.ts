import type { Expense } from '../lib/expenses';

export interface ExpenseTotals {
  estimate: number;
  actual: number;
}

export interface ExpenseMonthGroup extends ExpenseTotals {
  key: string;
  label: string;
  expenses: Expense[];
}

export interface ExpenseYearGroup extends ExpenseTotals {
  year: string;
  months: ExpenseMonthGroup[];
  expenseCount: number;
}

export function addExpenseToTotals(totals: ExpenseTotals, expense: Expense): void {
  totals[expense.kind === 'estimate' ? 'estimate' : 'actual'] += expense.amount;
}

export function buildExpenseTimeline(expenses: Expense[]): ExpenseYearGroup[] {
  const yearMap = new Map<string, Map<string, Expense[]>>();

  for (const expense of expenses) {
    const year = expense.expenseDate.slice(0, 4);
    const monthKey = expense.expenseDate.slice(0, 7);
    const monthMap = yearMap.get(year) ?? new Map<string, Expense[]>();
    const monthExpenses = monthMap.get(monthKey) ?? [];
    monthExpenses.push(expense);
    monthMap.set(monthKey, monthExpenses);
    yearMap.set(year, monthMap);
  }

  return [...yearMap.entries()]
    .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
    .map(([year, monthMap]) => {
      const yearTotals: ExpenseTotals = { estimate: 0, actual: 0 };
      let expenseCount = 0;
      const months = [...monthMap.entries()]
        .sort(([monthA], [monthB]) => monthB.localeCompare(monthA))
        .map(([key, monthExpenses]) => {
          const totals: ExpenseTotals = { estimate: 0, actual: 0 };
          const sortedExpenses = [...monthExpenses].sort(
            (a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt),
          );
          sortedExpenses.forEach((expense) => {
            addExpenseToTotals(totals, expense);
            addExpenseToTotals(yearTotals, expense);
          });
          expenseCount += sortedExpenses.length;
          const [groupYear, month] = key.split('-').map(Number);
          return {
            key,
            label: new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(groupYear, month - 1, 1)),
            expenses: sortedExpenses,
            ...totals,
          };
        });

      return { year, months, expenseCount, ...yearTotals };
    });
}
