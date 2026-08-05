import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { getCurrentDisplayName } from './auth';

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  createdBy: string | null;
  createdAt: string;
}

interface ChecklistItemRow {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  created_by: string | null;
  created_at: string;
}

function rowToItem(r: ChecklistItemRow): ChecklistItem {
  return { id: r.id, taskId: r.task_id, text: r.text, done: r.done, createdBy: r.created_by, createdAt: r.created_at };
}

export async function listChecklistItems(taskId: string): Promise<ChecklistItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('planner_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as ChecklistItemRow[]).map(rowToItem);
}

export async function addChecklistItem(taskId: string, text: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const trimmed = text.trim();
  if (!trimmed) return { error: null };
  const { error } = await supabase.from('planner_checklist_items').insert({
    id: uuid(),
    task_id: taskId,
    text: trimmed,
    done: false,
    created_by: getCurrentDisplayName(),
  });
  return { error: error?.message ?? null };
}

export async function toggleChecklistItem(id: string, done: boolean): Promise<void> {
  await supabase?.from('planner_checklist_items').update({ done }).eq('id', id);
}

export async function updateChecklistItem(id: string, text: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Der Checklistenpunkt darf nicht leer sein.' };
  const { error } = await supabase.from('planner_checklist_items').update({ text: trimmed }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteChecklistItem(id: string): Promise<void> {
  await supabase?.from('planner_checklist_items').delete().eq('id', id);
}

/** Realtime feed scoped to one task, so everyone with that task open sees
 * teammates ticking off or adding steps immediately. */
export function subscribeChecklistItems(
  taskId: string,
  onChange: () => void,
  subscriber = 'section',
): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel(`planner_checklist_items_${taskId}_${subscriber}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planner_checklist_items', filter: `task_id=eq.${taskId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
