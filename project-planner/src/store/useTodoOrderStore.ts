import { create } from 'zustand';

const STORAGE_KEY = 'myprosole-planner-todo-order';

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

interface TodoOrderStore {
  order: string[];
  /** Moves draggedId next to targetId within visibleIds (the currently
   * displayed, already-merged order across all columns) and persists the
   * whole resulting sequence as the new preference. visibleIds, not just
   * one column, so dragging a card into a different status column also
   * places it sensibly relative to that column's cards. */
  reorder: (visibleIds: string[], draggedId: string, targetId: string, placeAfter: boolean) => void;
}

/** Manual drag-to-reorder position within a Kanban column is a per-device
 * viewing preference, not project data -- moving a card up or down must
 * never touch the task's own dates/status/progress. Stored locally, like
 * collapse state (useOutlineStore), not synced to Supabase or shared with
 * anyone else looking at the same plan. */
export const useTodoOrderStore = create<TodoOrderStore>((set) => ({
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
}));

/** Applies a stored manual order on top of a naturally-sorted id list: ids
 * present in `order` keep that relative order; any id missing from it (a
 * new task, or before any reorder has ever happened) falls back to the end,
 * in its natural (date/title) position relative to the other unordered
 * ids -- never in front of something the user has explicitly placed. */
export function applyTodoOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return ordered;
}
