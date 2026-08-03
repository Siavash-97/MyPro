import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { cloudEnabled } from '../lib/supabase';
import { listAllExpenses, subscribeExpenses, type Expense } from '../lib/expenses';
import { computeOverallProgress, computePhaseProgress, nextMilestone, countOverdueTasks } from '../utils/dashboardStats';
import { formatShort, diffDays, today } from '../utils/date';
import { ResourceUtilization } from './ResourceUtilization';
import { exportExpensesAsCsv, exportExpensesAsPdf } from '../utils/exportExpenses';

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
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const expensesByWorkPackage = new Map<string, number>();
  for (const e of expenses) {
    const task = tasks.find((t) => t.id === e.taskId);
    const key = task?.workPackageId ?? '__none';
    expensesByWorkPackage.set(key, (expensesByWorkPackage.get(key) ?? 0) + e.amount);
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    await exportExpensesAsPdf(expenses, tasks, workPackages);
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
              <div className="text-[11px] font-medium text-gray-500 mb-1">Gesamtausgaben</div>
              <div className="text-2xl font-bold text-gray-800">{eur(totalExpenses)}</div>
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
                {[...expensesByWorkPackage.entries()].map(([key, sum]) => {
                  const wp = workPackages.find((w) => w.id === key);
                  return (
                    <div key={key} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="text-gray-700">{wp?.name ?? '– Ohne Arbeitspaket –'}</span>
                      <span className="font-medium text-gray-800">{eur(sum)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold bg-gray-50">
                  <span>Summe</span>
                  <span>{eur(totalExpenses)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
