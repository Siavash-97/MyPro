import { create } from 'zustand';

const STORAGE_KEY = 'myprosole-planner-gantt-order';

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // localStorage unavailable (private browsing etc.) -- manual order just won't persist
  }
}

interface GanttOrderStore {
  order: string[];
  /** Moves draggedId next to targetId within visibleIds (the currently
   * displayed, already-merged order) and persists the whole resulting
   * sequence. visibleIds should be the full cross-swimlane order so a task
   * dragged into a different person's group still lands sensibly relative
   * to that group's tasks. */
  reorder: (visibleIds: string[], draggedId: string, targetId: string, placeAfter: boolean) => void;
  /** Appends any id in `ids` that has no recorded position yet, in the
   * order given, without touching ids already present. Called with the
   * chart's current natural (date/title-sorted) row order every render --
   * the first time a task is ever displayed it gets locked into that
   * position for good, so unordered tasks default to today's sort exactly
   * once instead of continuing to re-sort live on every date edit
   * thereafter. A no-op (no store update at all) once everything visible is
   * already seeded, so this is safe to call on every render. */
  ensureSeeded: (ids: string[]) => void;
}

/** A task's row position on the Gantt chart is a manual arrangement the
 * user controls by dragging in the left-hand list -- it must never shift on
 * its own just because a date changed (that used to make bars visually
 * "slide" to a different row the moment two tasks' start dates crossed).
 * The chart itself only ever reads this order; nothing here changes a
 * task's own start/end/assignee. Local per-device preference, like
 * useTodoOrderStore for the Kanban board -- not synced to Supabase. */
export const useGanttOrderStore = create<GanttOrderStore>((set, get) => ({
  order: load(),
  reorder: (visibleIds, draggedId, targetId, placeAfter) => {
    if (draggedId === targetId) return;
    const withoutDragged = visibleIds.filter((id) => id !== draggedId);
    const targetIndex = withoutDragged.indexOf(targetId);
    if (targetIndex === -1) return;
    const insertAt = placeAfter ? targetIndex + 1 : targetIndex;
    const next = [...withoutDragged.slice(0, insertAt), draggedId, ...withoutDragged.slice(insertAt)];
    save(next);
    set({ order: next });
  },
  ensureSeeded: (ids) => {
    const current = get().order;
    const known = new Set(current);
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    const next = [...current, ...missing];
    save(next);
    set({ order: next });
  },
}));
