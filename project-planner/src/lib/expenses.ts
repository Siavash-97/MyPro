import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { getCurrentDisplayName } from './auth';
import { formatSize } from './attachments';
import { expandSubscriptions } from '../utils/expenseRecurrence';
import { today } from '../utils/date';

const BUCKET = 'planner-invoices';
export const MAX_INVOICE_SIZE = 20 * 1024 * 1024;

export type ExpenseKind = 'estimate' | 'actual';

export interface Expense {
  id: string;
  taskId: string;
  description: string;
  amount: number;
  currency: string;
  /** 'estimate' = planned cost from the funding application's cost plan,
   * 'actual' = a real invoice/expense entered as work happens -- lets the
   * two be compared once real costs start coming in. */
  kind: ExpenseKind;
  invoiceNumber: string | null;
  invoiceStoragePath: string | null;
  expenseDate: string;
  createdBy: string | null;
  createdAt: string;
  /** True for the one real row a recurring cost was entered as. */
  isSubscription: boolean;
  /** Recurrence period in months (1 = monthly, 12 = yearly, or a custom
   * count). Only meaningful when isSubscription is true. */
  recurrenceIntervalMonths: number | null;
  /** True for a generated future/past occurrence of a subscription -- not
   * a real database row, so it can't be edited, deleted, or carry its own
   * invoice file. Absent (falsy) for real rows. */
  isVirtualOccurrence?: boolean;
}

interface ExpenseRow {
  id: string;
  task_id: string;
  description: string;
  amount: number;
  currency: string;
  kind: ExpenseKind;
  invoice_number: string | null;
  invoice_storage_path: string | null;
  expense_date?: string | null;
  created_by: string | null;
  created_at: string;
  is_subscription?: boolean | null;
  recurrence_interval_months?: number | null;
}

function rowToExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    taskId: r.task_id,
    description: r.description,
    amount: r.amount,
    currency: r.currency,
    kind: r.kind ?? 'actual',
    invoiceNumber: r.invoice_number,
    invoiceStoragePath: r.invoice_storage_path,
    expenseDate: r.expense_date ?? r.created_at.slice(0, 10),
    createdBy: r.created_by,
    createdAt: r.created_at,
    isSubscription: r.is_subscription ?? false,
    recurrenceIntervalMonths: r.recurrence_interval_months ?? null,
  };
}

export async function listExpensesForTask(taskId: string): Promise<Expense[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('planner_expenses')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return expandSubscriptions((data as ExpenseRow[]).map(rowToExpense), today());
}

/** Unfiltered -- used by the Dashboard to sum/aggregate across the whole
 * plan. Task modals use listExpensesForTask instead. */
export async function listAllExpenses(): Promise<Expense[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('planner_expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return expandSubscriptions((data as ExpenseRow[]).map(rowToExpense), today());
}

export async function addExpense(
  taskId: string,
  fields: {
    description: string;
    amount: number;
    kind: ExpenseKind;
    expenseDate: string;
    invoiceNumber?: string;
    isSubscription?: boolean;
    recurrenceIntervalMonths?: number | null;
  },
  file?: File,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  if (file && file.size > MAX_INVOICE_SIZE) {
    return { error: `Datei ist zu groß (${formatSize(file.size)}). Maximal ${formatSize(MAX_INVOICE_SIZE)} pro Datei.` };
  }
  const id = uuid();
  let invoiceStoragePath: string | null = null;
  if (file) {
    const path = `${taskId}/${id}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
    if (uploadError) return { error: uploadError.message };
    invoiceStoragePath = path;
  }
  const { error: insertError } = await supabase.from('planner_expenses').insert({
    id,
    task_id: taskId,
    description: fields.description,
    amount: fields.amount,
    currency: 'EUR',
    kind: fields.kind,
    expense_date: fields.expenseDate,
    invoice_number: fields.invoiceNumber || null,
    invoice_storage_path: invoiceStoragePath,
    created_by: getCurrentDisplayName(),
    is_subscription: fields.isSubscription ?? false,
    recurrence_interval_months: fields.isSubscription ? (fields.recurrenceIntervalMonths ?? 1) : null,
  });
  if (insertError) {
    if (invoiceStoragePath) await supabase.storage.from(BUCKET).remove([invoiceStoragePath]);
    if (/expense_date|schema cache/i.test(insertError.message)) {
      return {
        error: 'Das Ausgabedatum ist in der Datenbank noch nicht eingerichtet. Bitte einmal supabase-expenses-date.sql im Supabase SQL Editor ausführen.',
      };
    }
    if (/is_subscription|recurrence_interval_months/i.test(insertError.message)) {
      return {
        error: 'Abo-Wiederholung ist in der Datenbank noch nicht eingerichtet. Bitte einmal supabase-expenses-subscription.sql im Supabase SQL Editor ausführen.',
      };
    }
    return { error: insertError.message };
  }
  return { error: null };
}

export async function deleteExpense(expense: Expense): Promise<void> {
  if (!supabase) return;
  // A virtual occurrence isn't a database row -- deleting it would either
  // no-op or, worse, match nothing and silently do nothing while the UI
  // implies success. Callers should not offer delete for these; this is a
  // defensive backstop.
  if (expense.isVirtualOccurrence) return;
  if (expense.invoiceStoragePath) {
    await supabase.storage.from(BUCKET).remove([expense.invoiceStoragePath]);
  }
  await supabase.from('planner_expenses').delete().eq('id', expense.id);
}

export async function getInvoiceDownloadUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 600);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Global, unfiltered realtime feed -- only the Dashboard subscribes (so its
 * total stays live), so opening N task modals doesn't open N channels;
 * TaskEditModal just re-fetches listExpensesForTask on task switch instead. */
export function subscribeExpenses(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('planner_expenses_all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_expenses' }, () => onChange())
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
