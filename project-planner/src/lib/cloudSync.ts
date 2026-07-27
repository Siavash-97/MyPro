import { supabase } from './supabase';
import type { ProjectData } from '../types';

const TABLE = 'project_state';
const ROW_ID = 'default';

interface PullResult {
  data: ProjectData | null;
  /** True once we got a real answer from the server (row found or genuinely
   * absent). False on a network/permission error, so callers don't mistake
   * "couldn't reach the server" for "there's nothing there yet". */
  ok: boolean;
}

export async function pullFromCloud(): Promise<PullResult> {
  if (!supabase) return { data: null, ok: false };
  const { data, error } = await supabase.from(TABLE).select('data').eq('id', ROW_ID).maybeSingle();
  if (error) return { data: null, ok: false };
  return { data: (data?.data as ProjectData | undefined) ?? null, ok: true };
}

export async function pushToCloud(data: ProjectData): Promise<void> {
  if (!supabase) return;
  await supabase.from(TABLE).upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() });
}

export function subscribeToCloud(onChange: (data: ProjectData) => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('project_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const newData = (payload.new as { data?: ProjectData } | null)?.data;
        if (newData) onChange(newData);
      },
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
