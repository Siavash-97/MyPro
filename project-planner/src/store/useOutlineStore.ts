import { create } from 'zustand';

const STORAGE_KEY = 'myprosole-planner-collapsed';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function save(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private browsing etc.) -- collapse state just won't persist
  }
}

interface OutlineStore {
  collapsedIds: Set<string>;
  toggle: (id: string) => void;
  collapseAll: (ids: string[]) => void;
  expandAll: () => void;
}

/** Which summary tasks are rolled up is a per-device viewing preference --
 * e.g. keeping years 2-5 collapsed while working in the current quarter,
 * a rolling-wave-planning outline level -- not part of the shared plan,
 * so it lives in localStorage rather than the cloud-synced project store. */
export const useOutlineStore = create<OutlineStore>((set, get) => ({
  collapsedIds: load(),
  toggle: (id) => {
    const next = new Set(get().collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
    set({ collapsedIds: next });
  },
  collapseAll: (ids) => {
    const next = new Set(ids);
    save(next);
    set({ collapsedIds: next });
  },
  expandAll: () => {
    const next = new Set<string>();
    save(next);
    set({ collapsedIds: next });
  },
}));
