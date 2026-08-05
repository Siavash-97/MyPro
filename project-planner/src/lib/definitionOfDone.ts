import { v4 as uuid } from 'uuid';
import { getCurrentDisplayName } from './auth';
import { supabase } from './supabase';

export interface DefinitionOfDoneItem {
  id: string;
  text: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDefinitionOfDoneCheck {
  taskId: string;
  itemId: string;
  done: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

interface DefinitionOfDoneRow {
  id: string;
  text: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskDefinitionOfDoneCheckRow {
  task_id: string;
  dod_item_id: string;
  done: boolean;
  updated_by: string | null;
  updated_at: string;
}

function rowToItem(row: DefinitionOfDoneRow): DefinitionOfDoneItem {
  return {
    id: row.id,
    text: row.text,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCheck(row: TaskDefinitionOfDoneCheckRow): TaskDefinitionOfDoneCheck {
  return {
    taskId: row.task_id,
    itemId: row.dod_item_id,
    done: row.done,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function listDefinitionOfDoneItems(): Promise<{
  items: DefinitionOfDoneItem[];
  error: string | null;
}> {
  if (!supabase) return { items: [], error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const { data, error } = await supabase
    .from('planner_dod_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return {
    items: data ? (data as DefinitionOfDoneRow[]).map(rowToItem) : [],
    error: error?.message ?? null,
  };
}

export async function listTaskDefinitionOfDoneChecks(taskId: string): Promise<{
  checks: TaskDefinitionOfDoneCheck[];
  error: string | null;
}> {
  if (!supabase) return { checks: [], error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const { data, error } = await supabase.from('planner_task_dod_checks').select('*').eq('task_id', taskId);
  return {
    checks: data ? (data as TaskDefinitionOfDoneCheckRow[]).map(rowToCheck) : [],
    error: error?.message ?? null,
  };
}

export async function addDefinitionOfDoneItem(text: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const trimmed = text.trim();
  if (!trimmed) return { error: null };
  const { data: lastRows, error: orderError } = await supabase
    .from('planner_dod_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (orderError) return { error: orderError.message };
  const lastOrder = Number(lastRows?.[0]?.sort_order ?? 0);
  const { error } = await supabase.from('planner_dod_items').insert({
    id: uuid(),
    text: trimmed,
    sort_order: lastOrder + 10,
    created_by: getCurrentDisplayName(),
  });
  return { error: error?.message ?? null };
}

export async function updateDefinitionOfDoneItem(id: string, text: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Der DoD-Punkt darf nicht leer sein.' };
  const { error } = await supabase
    .from('planner_dod_items')
    .update({ text: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteDefinitionOfDoneItem(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const { error } = await supabase.from('planner_dod_items').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function setTaskDefinitionOfDoneCheck(
  taskId: string,
  itemId: string,
  done: boolean,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const { error } = await supabase.from('planner_task_dod_checks').upsert(
    {
      task_id: taskId,
      dod_item_id: itemId,
      done,
      updated_by: getCurrentDisplayName(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'task_id,dod_item_id' },
  );
  return { error: error?.message ?? null };
}

/** One channel listens to both the global template and this task's checks,
 * so all open clients immediately receive edits and completion changes. */
export function subscribeDefinitionOfDone(
  taskId: string,
  onChange: () => void,
  subscriber = 'section',
): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel(`planner_dod_${taskId}_${subscriber}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_dod_items' }, onChange)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planner_task_dod_checks', filter: `task_id=eq.${taskId}` },
      onChange,
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
