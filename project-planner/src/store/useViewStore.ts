import { create } from 'zustand';

export type AppView = 'dashboard' | 'gantt';

interface ViewStore {
  activeView: AppView;
  setActiveView: (v: AppView) => void;
}

/** Which top-level page is shown -- purely a per-session viewing choice
 * (like which zoom level is selected), not part of the shared plan, so it
 * isn't persisted anywhere: every fresh login lands back on the Dashboard. */
export const useViewStore = create<ViewStore>((set) => ({
  activeView: 'dashboard',
  setActiveView: (v) => set({ activeView: v }),
}));
