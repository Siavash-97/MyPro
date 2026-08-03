import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { getCurrentDisplayName } from './auth';
import { formatSize } from './attachments';

const BUCKET = 'planner-invoices';
export const MAX_INVOICE_SIZE = 20 * 1024 * 1024;

export interface Expense {
  id: string;
  taskId: string;
  description: string;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  invoiceStoragePath: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface ExpenseRow {
  id: string;
  task_id: string;
  description: string;
  amount: number;
  currency: string;
  invoice_number: string | null;
  invoice_storage_path: string | null;
  created_by: string | null;
  created_at: string;
}

function rowToExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    taskId: r.task_id,
    description: r.description,
    amount: r.amount,
    currency: r.currency,
    invoiceNumber: r.invoice_number,
    invoiceStoragePath: r.invoice_storage_path,
    createdBy: r.created_by,
    createdAt: r.created_at,
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
  return (data as ExpenseRow[]).map(rowToExpense);
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
  return (data as ExpenseRow[]).map(rowToExpense);
}

export async function addExpense(
  taskId: string,
  fields: { description: string; amount: number; invoiceNumber?: string },
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
    invoice_number: fields.invoiceNumber || null,
    invoice_storage_path: invoiceStoragePath,
    created_by: getCurrentDisplayName(),
  });
  if (insertError) {
    if (invoiceStoragePath) await supabase.storage.from(BUCKET).remove([invoiceStoragePath]);
    return { error: insertError.message };
  }
  return { error: null };
}

export async function deleteExpense(expense: Expense): Promise<void> {
  if (!supabase) return;
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
