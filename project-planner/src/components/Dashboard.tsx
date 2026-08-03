import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { cloudEnabled } from '../lib/supabase';
import { listAllExpenses, subscribeExpenses, type Expense } from '../lib/expenses';
import { computeOverallProgress, computePhaseProgress, nextMilestone, countOverdueTasks } from '../utils/dashboardStats';
import { formatShort, diffDays, today } from '../utils/date';
import { ResourceUtilization } from './ResourceUtilization';
import { exportExpensesAsCsv, exportExpensesAsPdf, exportComparisonAsCsv, exportComparisonAsPdf } from '../utils/exportExpenses';
import { computeExpenseComparison, NOTABLE_THRESHOLD } from '../utils/expenseComparison';

function eur(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function Dashboard() {
  const tasks = useProjectStore((s) => s.tasks);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!cloudEnabled) return;
    listAllExpenses().then(setExpenses);
    return subscribeExpenses(() => {
      listAllExpenses().then(setExpenses);
    });
  }, []);

  const overallProgress = computeOverallProgress(tasks);
  const phases = computePhaseProgress(tasks);
  const milestone = nextMilestone(tasks);
  const overdueCount = countOverdueTasks(tasks);
  const estimateTotal = expenses.filter((e) => e.kind === 'estimate').reduce((sum, e) => sum + e.amount, 0);
  const actualTotal = expenses.filter((e) => e.kind === 'actual').reduce((sum, e) => sum + e.amount, 0);

  const expensesByWorkPackage = new Map<string, { estimate: number; actual: number }>();
  for (const e of expenses) {
    const task = tasks.find((t) => t.id === e.taskId);
    const key = task?.workPackageId ?? '__none';
    const entry = expensesByWorkPackage.get(key) ?? { estimate: 0, actual: 0 };
    if (e.kind === 'estimate') entry.estimate += e.amount;
    else entry.actual += e.amount;
    expensesByWorkPackage.set(key, entry);
  }

  const comparison = computeExpenseComparison(expenses, tasks);

  async function handleExportPdf() {
    setExportingPdf(true);
    await exportExpensesAsPdf(expenses, tasks, workPackages);
    setExportingPdf(false);
  }

  async function handleExportComparisonPdf() {
    setExportingPdf(true);
    await exportComparisonAsPdf(comparison);
    setExportingPdf(false);
  }

  return (
    <div className="flex-1 overflow-auto bg-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-lg font-bold text-gray-800">Projekt-Übersicht</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[11px] font-medium text-gray-500 mb-1">Gesamtfortschritt</div>
            <div className="text-2xl font-bold text-gray-800">{overallProgress}%</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[11px] font-medium text-gray-500 mb-1">Nächster Meilenstein</div>
            {milestone ? (
              <>
                <div className="text-sm font-semibold text-gray-800 truncate" title={milestone.title}>
                  {milestone.title}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {formatShort(milestone.start)} · in {diffDays(today(), milestone.start)} Tagen
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400">Kein bevorstehender Meilenstein</div>
            )}
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[11px] font-medium text-gray-500 mb-1">Überfällige Aufgaben</div>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{overdueCount}</div>
          </div>
          {cloudEnabled && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-[11px] font-medium text-gray-500 mb-1">Kosten (geschätzt / real)</div>
              <div className="text-lg font-bold text-gray-800">
                {eur(estimateTotal)} <span className="text-gray-300 font-normal">/</span>{' '}
                <span className="text-emerald-700">{eur(actualTotal)}</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Fortschritt je Phase</h2>
          {phases.length === 0 ? (
            <p className="text-xs text-gray-400">Noch keine Phasen (Aufgaben mit Unteraufgaben) angelegt.</p>
          ) : (
            <div className="space-y-2">
              {phases.map(({ task, rollup }) => (
                <button
                  key={task.id}
                  onClick={() => setEditingTask(task.id)}
                  className="w-full text-left border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-800 truncate">{task.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatShort(rollup.start)} – {formatShort(rollup.end)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${rollup.progress}%`, background: task.color }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Ressourcen-Auslastung</h2>
          <ResourceUtilization tasks={tasks} people={people} />
        </div>

        {cloudEnabled && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Ausgaben</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => exportExpensesAsCsv(expenses, tasks, workPackages)}
                  disabled={expenses.length === 0}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md disabled:opacity-40"
                >
                  Als Excel exportieren
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={expenses.length === 0 || exportingPdf}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md disabled:opacity-40"
                >
                  {exportingPdf ? 'Exportiere…' : 'Als PDF exportieren'}
                </button>
              </div>
            </div>
            {expenses.length === 0 ? (
              <p className="text-xs text-gray-400">Noch keine Ausgaben erfasst. Trage sie im Aufgaben-Dialog ein.</p>
            ) : (
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                <div className="flex items-center justify-between px-3 py-1.5 text-[10.5px] font-medium text-gray-400">
                  <span>Arbeitspaket</span>
                  <span className="flex gap-4">
                    <span className="w-20 text-right">Geschätzt</span>
                    <span className="w-20 text-right">Real</span>
                  </span>
                </div>
                {[...expensesByWorkPackage.entries()].map(([key, sums]) => {
                  const wp = workPackages.find((w) => w.id === key);
                  return (
                    <div key={key} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="text-gray-700">{wp?.name ?? '– Ohne Arbeitspaket –'}</span>
                      <span className="flex gap-4">
                        <span className="w-20 text-right text-gray-600">{eur(sums.estimate)}</span>
                        <span className="w-20 text-right font-medium text-emerald-700">{eur(sums.actual)}</span>
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold bg-gray-50">
                  <span>Summe</span>
                  <span className="flex gap-4">
                    <span className="w-20 text-right">{eur(estimateTotal)}</span>
                    <span className="w-20 text-right text-emerald-700">{eur(actualTotal)}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {cloudEnabled && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Geschätzt vs. Real</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Zeilen mit mehr als {NOTABLE_THRESHOLD} € Abweichung sind hervorgehoben.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportComparisonAsCsv(comparison)}
                  disabled={comparison.length === 0}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md disabled:opacity-40"
                >
                  Report als Excel
                </button>
                <button
                  onClick={handleExportComparisonPdf}
                  disabled={comparison.length === 0 || exportingPdf}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md disabled:opacity-40"
                >
                  {exportingPdf ? 'Exportiere…' : 'Report als PDF'}
                </button>
              </div>
            </div>
            {comparison.length === 0 ? (
              <p className="text-xs text-gray-400">
                Sobald für dieselbe Aufgabe sowohl geschätzte als auch reale Ausgaben erfasst sind, erscheint hier der Vergleich.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                <div className="flex items-center justify-between px-3 py-1.5 text-[10.5px] font-medium text-gray-400">
                  <span>Aufgabe</span>
                  <span className="flex gap-4 shrink-0">
                    <span className="w-20 text-right">Geschätzt</span>
                    <span className="w-20 text-right">Real</span>
                    <span className="w-20 text-right">Differenz</span>
                  </span>
                </div>
                {comparison.map((row) => (
                  <button
                    key={row.taskId}
                    onClick={() => setEditingTask(row.taskId)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-50 ${
                      row.notable ? 'bg-red-50' : ''
                    }`}
                  >
                    <span className="truncate text-gray-700">{row.taskTitle}</span>
                    <span className="flex gap-4 shrink-0">
                      <span className="w-20 text-right text-gray-600">{eur(row.estimate)}</span>
                      <span className="w-20 text-right text-emerald-700">{eur(row.actual)}</span>
                      <span className={`w-20 text-right font-semibold ${row.notable ? 'text-red-600' : 'text-gray-500'}`}>
                        {row.delta === null ? '–' : `${row.delta > 0 ? '+' : ''}${eur(row.delta)}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
