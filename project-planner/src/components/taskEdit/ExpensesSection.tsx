import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  listExpensesForTask,
  addExpense,
  deleteExpense,
  getInvoiceDownloadUrl,
  type Expense,
  type ExpenseKind,
} from '../../lib/expenses';
import { formatShort, today } from '../../utils/date';

export function ExpensesSection({
  taskId,
  taskTitle,
  isViewer,
}: {
  taskId: string;
  taskTitle: string;
  isViewer: boolean;
}) {
  const logActivity = useProjectStore((s) => s.logActivity);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>('actual');
  const [expenseInvoiceNumber, setExpenseInvoiceNumber] = useState('');
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const expenseFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listExpensesForTask(taskId).then(setExpenses);
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseDate(today());
    setExpenseKind('actual');
    setExpenseInvoiceNumber('');
    setExpenseFile(null);
    setExpenseError('');
  }, [taskId]);

  async function refreshExpenses() {
    setExpenses(await listExpensesForTask(taskId));
  }

  async function handleAddExpense() {
    const amount = parseFloat(expenseAmount.replace(',', '.'));
    const description = expenseDescription.trim();
    if (!description || !amount || amount <= 0) {
      setExpenseError('Bitte Beschreibung und einen gültigen Betrag angeben.');
      return;
    }
    if (!expenseDate) {
      setExpenseError('Bitte ein Ausgabedatum angeben.');
      return;
    }
    setSavingExpense(true);
    setExpenseError('');
    const { error } = await addExpense(
      taskId,
      {
        description,
        amount,
        kind: expenseKind,
        expenseDate,
        invoiceNumber: expenseInvoiceNumber.trim() || undefined,
      },
      expenseFile ?? undefined,
    );
    setSavingExpense(false);
    if (error) {
      setExpenseError(error);
      return;
    }
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseDate(today());
    setExpenseKind('actual');
    setExpenseInvoiceNumber('');
    setExpenseFile(null);
    if (expenseFileInputRef.current) expenseFileInputRef.current.value = '';
    await refreshExpenses();
    const kindLabel = expenseKind === 'estimate' ? 'Geschätzt' : 'Real';
    logActivity(`Ausgabe "${description}" (${amount.toFixed(2)} €, ${kindLabel}) zu Aufgabe "${taskTitle}" hinzugefügt.`);
  }

  async function handleDeleteExpense(expense: Expense) {
    await deleteExpense(expense);
    await refreshExpenses();
    logActivity(`Ausgabe "${expense.description}" von Aufgabe "${taskTitle}" entfernt.`);
  }

  async function handleDownloadInvoice(expense: Expense) {
    if (!expense.invoiceStoragePath) return;
    const url = await getInvoiceDownloadUrl(expense.invoiceStoragePath);
    if (url) window.open(url, '_blank');
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Ausgaben</label>
      <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
        {expenses.map((exp) => (
          <div key={exp.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    exp.kind === 'estimate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {exp.kind === 'estimate' ? 'Geschätzt' : 'Real'}
                </span>
                <span className="truncate text-gray-700">{exp.description}</span>
              </div>
              <div className="text-gray-400">
                {formatShort(exp.expenseDate)}{exp.invoiceNumber ? ` · Rechnungsnr. ${exp.invoiceNumber}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-medium text-gray-700">
                {exp.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
              {exp.invoiceStoragePath && (
                <button onClick={() => handleDownloadInvoice(exp)} className="text-blue-600 hover:underline" title="Rechnung öffnen">
                  📎
                </button>
              )}
              {!isViewer && (
                <button
                  onClick={() => handleDeleteExpense(exp)}
                  className="text-gray-400 hover:text-red-600"
                  title="Ausgabe entfernen"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        ))}
        {expenses.length === 0 && <div className="px-2.5 py-2 text-xs text-gray-400">Keine Ausgaben erfasst.</div>}
        {expenses.length > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold bg-gray-50">
            <span>Zwischensumme</span>
            <span>{expenses.reduce((s, e) => s + e.amount, 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        )}
      </div>
      {!isViewer && (
        <div className="mt-2 space-y-1.5">
          <input
            type="text"
            value={expenseDescription}
            onChange={(e) => setExpenseDescription(e.target.value)}
            placeholder="Beschreibung"
            className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs"
          />
          <div>
            <label className="block text-[10.5px] text-gray-500 mb-0.5">Ausgabedatum</label>
            <input
              type="date"
              aria-label="Ausgabedatum"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs bg-white"
            />
          </div>
          <div className="flex gap-1.5">
            <input
              type="number"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="Betrag (€)"
              className="flex-1 min-w-0 border border-gray-200 rounded-md px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={expenseInvoiceNumber}
              onChange={(e) => setExpenseInvoiceNumber(e.target.value)}
              placeholder="Rechnungsnr. (optional)"
              className="flex-1 min-w-0 border border-gray-200 rounded-md px-2 py-1 text-xs"
            />
          </div>
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden w-fit">
            <button
              onClick={() => setExpenseKind('actual')}
              className={`text-xs font-medium px-2.5 py-1 ${expenseKind === 'actual' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Real
            </button>
            <button
              onClick={() => setExpenseKind('estimate')}
              className={`text-xs font-medium px-2.5 py-1 ${expenseKind === 'estimate' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'}`}
            >
              Geschätzt
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => expenseFileInputRef.current?.click()}
              className="text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-2.5 py-1 rounded-md hover:border-gray-400 hover:text-gray-700"
            >
              {expenseFile ? expenseFile.name : '+ Rechnung anhängen'}
            </button>
            <button
              onClick={handleAddExpense}
              disabled={savingExpense}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md disabled:opacity-50"
            >
              {savingExpense ? 'Speichert…' : 'Ausgabe hinzufügen'}
            </button>
          </div>
          <input
            ref={expenseFileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
            className="hidden"
            onChange={(e) => setExpenseFile(e.target.files?.[0] ?? null)}
          />
          {expenseError && <p className="text-xs text-red-600">{expenseError}</p>}
        </div>
      )}
    </div>
  );
}
