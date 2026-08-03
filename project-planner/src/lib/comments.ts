import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { getCurrentDisplayName } from './auth';

export interface Comment {
  id: string;
  taskId: string;
  author: string | null;
  message: string;
  createdAt: string;
}

interface CommentRow {
  id: string;
  task_id: string;
  author: string | null;
  message: string;
  created_at: string;
}

function rowToComment(r: CommentRow): Comment {
  return { id: r.id, taskId: r.task_id, author: r.author, message: r.message, createdAt: r.created_at };
}

export async function listComments(taskId: string): Promise<Comment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('planner_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as CommentRow[]).map(rowToComment);
}

export async function addComment(taskId: string, message: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const trimmed = message.trim();
  if (!trimmed) return { error: null };
  const { error } = await supabase.from('planner_comments').insert({
    id: uuid(),
    task_id: taskId,
    author: getCurrentDisplayName(),
    message: trimmed,
  });
  return { error: error?.message ?? null };
}

export async function deleteComment(id: string): Promise<void> {
  await supabase?.from('planner_comments').delete().eq('id', id);
}

/** Realtime feed scoped to one task, so everyone with that task open sees
 * new comments (and deletions) from teammates immediately. */
export function subscribeComments(taskId: string, onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel(`planner_comments_${taskId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planner_comments', filter: `task_id=eq.${taskId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
