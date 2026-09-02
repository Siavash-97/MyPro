import { useEffect, useState } from 'react';
import { listAllChecklistItems, subscribeAllChecklistItems, type ChecklistItem } from '../lib/checklist';

/** Backs the To-Do Kanban's checklist cards and the checklist-driven
 * progress sync: loads every checklist item once, then stays live via
 * realtime so a step someone ticks off on another device shows up
 * immediately. `subscriber` must be distinct per call site -- it names the
 * underlying realtime channel, and two mounts sharing one name would fight
 * over the same channel instead of each getting their own. */
export function useAllChecklistItems(subscriber: string): ChecklistItem[] {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      listAllChecklistItems().then((next) => {
        if (!cancelled) setItems(next);
      });
    };
    refresh();
    const unsubscribe = subscribeAllChecklistItems(refresh, subscriber);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [subscriber]);

  return items;
}
