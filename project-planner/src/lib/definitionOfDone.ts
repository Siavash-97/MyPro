import { v4 as uuid } from 'uuid';
import { getCurrentDisplayName } from './auth';
import { supabase } from './supabase';

export interface DefinitionOfDoneItem {
  id: string;
  workPackageId: string | null;
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
  work_package_id: string | null;
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
    workPackageId: row.work_package_id,
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

export async function listDefinitionOfDoneItems(workPackageId: string | null): Promise<{
  items: DefinitionOfDoneItem[];
  error: string | null;
}> {
  if (!workPackageId) return { items: [], error: null };
  if (!supabase) return { items: [], error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const { data, error } = await supabase
    .from('planner_dod_items')
    .select('*')
    .eq('work_package_id', workPackageId)
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

export async function addDefinitionOfDoneItem(
  workPackageId: string | null,
  text: string,
): Promise<{ error: string | null }> {
  if (!workPackageId) return { error: 'Bitte zuerst ein Arbeitspaket zuweisen.' };
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const trimmed = text.trim();
  if (!trimmed) return { error: null };
  const { data: lastRows, error: orderError } = await supabase
    .from('planner_dod_items')
    .select('sort_order')
    .eq('work_package_id', workPackageId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (orderError) return { error: orderError.message };
  const lastOrder = Number(lastRows?.[0]?.sort_order ?? 0);
  const { error } = await supabase.from('planner_dod_items').insert({
    id: uuid(),
    work_package_id: workPackageId,
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

/** One channel listens to this work package's template and this task's
 * checks, so all open clients immediately receive relevant changes. */
export function subscribeDefinitionOfDone(
  taskId: string,
  workPackageId: string | null,
  onChange: () => void,
  subscriber = 'section',
): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel(`planner_dod_${taskId}_${workPackageId ?? 'unassigned'}_${subscriber}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'planner_dod_items',
        filter: `work_package_id=eq.${workPackageId ?? '__unassigned__'}`,
      },
      onChange,
    )
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
