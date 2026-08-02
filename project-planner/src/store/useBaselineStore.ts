import { create } from 'zustand';
import type { Task } from '../types';
import {
  pullBaseline,
  saveBaseline as saveBaselineRemote,
  clearBaseline as clearBaselineRemote,
  subscribeBaseline,
  type BaselineEntry,
} from '../lib/db';

interface BaselineStore {
  baseline: Record<string, BaselineEntry>;
  show: boolean;
  setShow: (v: boolean) => void;
  load: () => Promise<void>;
  save: (tasks: Task[]) => Promise<void>;
  clear: () => Promise<void>;
}

/** Separate from the main project store on purpose: a baseline is a
 * read-mostly reference snapshot, not part of the undo history or the
 * live-edited plan, so it doesn't belong in useProjectStore's undo/redo
 * or persisted-local-state machinery. */
export const useBaselineStore = create<BaselineStore>((set, get) => ({
  baseline: {},
  show: false,
  setShow: (v) => set({ show: v }),
  load: async () => {
    set({ baseline: await pullBaseline() });
  },
  save: async (tasks) => {
    await saveBaselineRemote(tasks);
    await get().load();
  },
  clear: async () => {
    await clearBaselineRemote();
    set({ baseline: {} });
  },
}));

let unsubscribeBaseline: (() => void) | null = null;

export function initBaselineSync() {
  useBaselineStore.getState().load();
  unsubscribeBaseline?.();
  unsubscribeBaseline = subscribeBaseline(() => useBaselineStore.getState().load());
}
