import { useMemo, useState } from 'react';
import type { Expense } from '../lib/expenses';
import type { Task } from '../types';
import { formatShort, today } from '../utils/date';
import { buildExpenseTimeline } from '../utils/expenseTimeline';

function eur(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function AmountColumns({ estimate, actual }: { estimate: number; actual: number }) {
  return (
    <span className="flex gap-4 shrink-0">
      <span className="w-20 text-right text-gray-600">{estimate ? eur(estimate) : '–'}</span>
      <span className="w-20 text-right font-medium text-emerald-700">{actual ? eur(actual) : '–'}</span>
    </span>
  );
}

export function ExpenseTimeline({
  expenses,
  tasks,
  onOpenTask,
}: {
  expenses: Expense[];
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
}) {
  const timeline = useMemo(() => buildExpenseTimeline(expenses), [expenses]);
  const currentYear = today().slice(0, 4);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set([currentYear]));
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const estimateTotal = expenses
    .filter((expense) => expense.kind === 'estimate')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const actualTotal = expenses
    .filter((expense) => expense.kind === 'actual')
    .reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="border border-gray-200 rounded-md divide-y divide-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 text-[10.5px] font-medium text-gray-400">
        <span>Zeitraum / Ausgabe</span>
        <span className="flex gap-4">
          <span className="w-20 text-right">Geschätzt</span>
          <span className="w-20 text-right">Real</span>
        </span>
      </div>

      {timeline.map((yearGroup) => {
        const yearOpen = expandedYears.has(yearGroup.year);
        return (
          <div key={yearGroup.year} className="divide-y divide-gray-100">
            <button
              type="button"
              aria-expanded={yearOpen}
              onClick={() => toggle(setExpandedYears, yearGroup.year)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left bg-gray-50 hover:bg-gray-100"
            >
              <span className="flex items-center gap-2">
                <span className="w-3 text-gray-400">{yearOpen ? '▾' : '▸'}</span>
                <span>{yearGroup.year}{yearGroup.year === currentYear ? ' · laufendes Jahr' : ''}</span>
                <span className="font-normal text-gray-400">({yearGroup.expenseCount})</span>
              </span>
              <AmountColumns estimate={yearGroup.estimate} actual={yearGroup.actual} />
            </button>

            {yearOpen && yearGroup.months.map((monthGroup) => {
              const monthOpen = expandedMonths.has(monthGroup.key);
              return (
                <div key={monthGroup.key} className="divide-y divide-gray-100">
                  <button
                    type="button"
                    aria-expanded={monthOpen}
                    onClick={() => toggle(setExpandedMonths, monthGroup.key)}
                    className="w-full flex items-center justify-between pl-7 pr-3 py-2 text-xs text-left hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 font-medium text-gray-700">
                      <span className="w-3 text-gray-400">{monthOpen ? '▾' : '▸'}</span>
                      <span className="capitalize">{monthGroup.label}</span>
                      <span className="font-normal text-gray-400">({monthGroup.expenses.length})</span>
                    </span>
                    <AmountColumns estimate={monthGroup.estimate} actual={monthGroup.actual} />
                  </button>

                  {monthOpen && monthGroup.expenses.map((expense) => {
                    const task = tasks.find((item) => item.id === expense.taskId);
                    return (
                      <button
                        key={expense.id}
                        type="button"
                        onClick={() => task && onOpenTask(task.id)}
                        disabled={!task}
                        className="w-full flex items-center justify-between pl-12 pr-3 py-2 text-xs text-left hover:bg-blue-50 disabled:hover:bg-white"
                      >
                        <span className="min-w-0 pr-3">
                          <span className="text-gray-400 mr-2">{formatShort(expense.expenseDate)}</span>
                          <span className="font-medium text-gray-700">{expense.description}</span>
                          {(expense.isSubscription || expense.isVirtualOccurrence) && (
                            <span
                              className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700"
                              title="Wiederkehrende Ausgabe (Abo)"
                            >
                              ↻ Abo
                            </span>
                          )}
                          <span className="block truncate text-[10.5px] text-gray-400 mt-0.5">
                            {task?.title ?? 'Gelöschte Aufgabe'}
                            {expense.invoiceNumber ? ` · Rechnung ${expense.invoiceNumber}` : ''}
                          </span>
                        </span>
                        <AmountColumns
                          estimate={expense.kind === 'estimate' ? expense.amount : 0}
                          actual={expense.kind === 'actual' ? expense.amount : 0}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold bg-gray-50">
        <span>Gesamtsumme</span>
        <AmountColumns estimate={estimateTotal} actual={actualTotal} />
      </div>
    </div>
  );
}
