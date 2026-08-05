import { useCallback, useEffect, useState } from 'react';
import { listChecklistItems, subscribeChecklistItems } from '../lib/checklist';
import { listComments, subscribeComments } from '../lib/comments';
import {
  listDefinitionOfDoneItems,
  listTaskDefinitionOfDoneChecks,
  subscribeDefinitionOfDone,
} from '../lib/definitionOfDone';
import {
  calculateTaskTabCounts,
  EMPTY_TASK_TAB_COUNTS,
  type TaskEditTabCounts,
} from '../utils/taskTabCounts';

/**
 * Loads the compact counters shown in the task modal tabs. It stays mounted
 * while any tab is open, so the counters remain live even when their content
 * section is not currently rendered.
 */
export function useTaskTabCounts(taskId: string | null, enabled: boolean): TaskEditTabCounts {
  const [counts, setCounts] = useState<TaskEditTabCounts>(EMPTY_TASK_TAB_COUNTS);

  const refresh = useCallback(async () => {
    if (!enabled || !taskId) {
      setCounts(EMPTY_TASK_TAB_COUNTS);
      return;
    }

    const [checklist, comments, definition, definitionChecks] = await Promise.all([
      listChecklistItems(taskId),
      listComments(taskId),
      listDefinitionOfDoneItems(),
      listTaskDefinitionOfDoneChecks(taskId),
    ]);
    setCounts(calculateTaskTabCounts(
      checklist,
      comments.length,
      definition.items,
      definitionChecks.checks,
    ));
  }, [enabled, taskId]);

  useEffect(() => {
    void refresh();
    if (!enabled || !taskId) return;

    const unsubscribeChecklist = subscribeChecklistItems(taskId, () => void refresh(), 'tab-counts');
    const unsubscribeComments = subscribeComments(taskId, () => void refresh(), 'tab-counts');
    const unsubscribeDefinition = subscribeDefinitionOfDone(taskId, () => void refresh(), 'tab-counts');
    return () => {
      unsubscribeChecklist();
      unsubscribeComments();
      unsubscribeDefinition();
    };
  }, [enabled, taskId, refresh]);

  return counts;
}
