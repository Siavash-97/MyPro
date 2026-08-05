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
import { definitionOfDoneItemsForWorkPackage } from '../utils/definitionOfDoneScope';
import { listAttachments, subscribeAttachments } from '../lib/attachments';

/**
 * Loads the compact counters shown in the task modal tabs. It stays mounted
 * while any tab is open, so the counters remain live even when their content
 * section is not currently rendered.
 */
export function useTaskTabCounts(
  taskId: string | null,
  workPackageId: string | null,
  enabled: boolean,
): TaskEditTabCounts {
  const [counts, setCounts] = useState<TaskEditTabCounts>(EMPTY_TASK_TAB_COUNTS);

  const refresh = useCallback(async () => {
    if (!enabled || !taskId) {
      setCounts(EMPTY_TASK_TAB_COUNTS);
      return;
    }

    const [checklist, comments, definition, definitionChecks, attachments] = await Promise.all([
      listChecklistItems(taskId),
      listComments(taskId),
      listDefinitionOfDoneItems(workPackageId),
      listTaskDefinitionOfDoneChecks(taskId),
      listAttachments(taskId),
    ]);
    const scopedDefinitionItems = definitionOfDoneItemsForWorkPackage(definition.items, workPackageId);
    setCounts(calculateTaskTabCounts(
      checklist,
      comments.length,
      scopedDefinitionItems,
      definitionChecks.checks,
      attachments.length,
    ));
  }, [enabled, taskId, workPackageId]);

  useEffect(() => {
    void refresh();
    if (!enabled || !taskId) return;

    const unsubscribeChecklist = subscribeChecklistItems(taskId, () => void refresh(), 'tab-counts');
    const unsubscribeComments = subscribeComments(taskId, () => void refresh(), 'tab-counts');
    const unsubscribeDefinition = subscribeDefinitionOfDone(
      taskId,
      workPackageId,
      () => void refresh(),
      'tab-counts',
    );
    const unsubscribeAttachments = subscribeAttachments(taskId, () => void refresh(), 'tab-counts');
    return () => {
      unsubscribeChecklist();
      unsubscribeComments();
      unsubscribeDefinition();
      unsubscribeAttachments();
    };
  }, [enabled, taskId, workPackageId, refresh]);

  return counts;
}
