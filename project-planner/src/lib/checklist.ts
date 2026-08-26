import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { getCurrentDisplayName } from './auth';
import { normalizeChecklistStatus } from '../utils/checklistTodos';
import type { TaskStatus } from '../types';

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  status: TaskStatus;
  createdBy: string | null;
  createdAt: string;
}

interface ChecklistItemRow {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  status?: string | null;
  created_by: string | null;
  created_at: string;
}

function rowToItem(r: ChecklistItemRow): ChecklistItem {
  return {
    id: r.id,
    taskId: r.task_id,
    text: r.text,
    done: r.done,
    status: normalizeChecklistStatus(r.status, r.done),
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
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

/** Every checklist item across every task -- backs the To-Do Kanban, which
 * mirrors each item as its own card next to the task it belongs to instead
 * of only showing it inside the task's edit dialog. */
export async function listAllChecklistItems(): Promise<ChecklistItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('planner_checklist_items')
    .select('*')
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
  if (!supabase) return;
  await setChecklistItemStatus(id, done ? 'completed' : 'not_started', done);
}

/** Moves a checklist item to any of the four Kanban columns (used by
 * drag-and-drop on the To-Do board). `done` is derived from the status
 * unless a caller already knows it (toggleChecklistItem does, to avoid a
 * redundant computation).
 *
 * Falls back to writing only `done` if the `status` column doesn't exist
 * yet (migration `supabase-checklist-status-setup.sql` not run) -- the item
 * still ends up in the right of the two columns that existed before this
 * feature, it just can't hold "in_progress"/"waiting" until then. */
export async function setChecklistItemStatus(
  id: string,
  status: TaskStatus,
  done: boolean = status === 'completed',
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('planner_checklist_items').update({ status, done }).eq('id', id);
  if (error && /status/i.test(error.message)) {
    await supabase.from('planner_checklist_items').update({ done }).eq('id', id);
  }
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

/** Unfiltered realtime feed for the To-Do Kanban -- unlike
 * subscribeChecklistItems, it isn't scoped to one open task, since the
 * Kanban shows checklist items from every task at once. */
export function subscribeAllChecklistItems(onChange: () => void, subscriber = 'kanban'): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel(`planner_checklist_items_all_${subscriber}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planner_checklist_items' },
      () => onChange(),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
