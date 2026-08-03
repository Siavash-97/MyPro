import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type Role = 'editor' | 'viewer';

interface RoleStore {
  role: Role;
  load: () => Promise<void>;
}

/** A user with no planner_profiles row defaults to 'editor' -- matches the
 * database's default-editor RLS fallback, so an account nobody has
 * explicitly restricted keeps full access. Loaded once at login (see
 * LoginGate) before the app renders, so there's no window where a viewer
 * briefly sees editor controls. */
export const useRoleStore = create<RoleStore>((set) => ({
  role: 'editor',
  load: async () => {
    if (!supabase) {
      set({ role: 'editor' });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      set({ role: 'editor' });
      return;
    }
    const { data, error } = await supabase.from('planner_profiles').select('role').eq('id', uid).maybeSingle();
    set({ role: error || !data ? 'editor' : (data.role as Role) });
  },
}));
