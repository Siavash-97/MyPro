import { useEffect, useState } from 'react';
import { listAllChecklistItems, subscribeAllChecklistItems, type ChecklistItem } from '../lib/checklist';

/** Backs the To-Do Kanban's checklist cards: loads every checklist item
 * once, then stays live via realtime so a step someone ticks off on another
 * device moves columns here immediately. */
export function useAllChecklistItems(): ChecklistItem[] {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      listAllChecklistItems().then((next) => {
        if (!cancelled) setItems(next);
      });
    };
    refresh();
    const unsubscribe = subscribeAllChecklistItems(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return items;
}
