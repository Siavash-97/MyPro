import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { getCurrentDisplayName } from './auth';

const BUCKET = 'planner-attachments';

export interface Attachment {
  id: string;
  taskId: string;
  name: string;
  storagePath: string;
  contentType: string | null;
  size: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface AttachmentRow {
  id: string;
  task_id: string;
  name: string;
  storage_path: string;
  content_type: string | null;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

function rowToAttachment(r: AttachmentRow): Attachment {
  return {
    id: r.id,
    taskId: r.task_id,
    name: r.name,
    storagePath: r.storage_path,
    contentType: r.content_type,
    size: r.size,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('planner_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as AttachmentRow[]).map(rowToAttachment);
}

export async function uploadAttachment(taskId: string, file: File): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Speicher ist nicht konfiguriert.' };
  const id = uuid();
  const path = `${taskId}/${id}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) return { error: uploadError.message };
  const { error: insertError } = await supabase.from('planner_attachments').insert({
    id,
    task_id: taskId,
    name: file.name,
    storage_path: path,
    content_type: file.type || null,
    size: file.size,
    uploaded_by: getCurrentDisplayName(),
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: insertError.message };
  }
  return { error: null };
}

export async function deleteAttachment(att: Attachment): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([att.storagePath]);
  await supabase.from('planner_attachments').delete().eq('id', att.id);
}

export async function getDownloadUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 600);
  if (error || !data) return null;
  return data.signedUrl;
}

export function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
