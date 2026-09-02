import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useAllChecklistItems } from './useAllChecklistItems';
import { hasChildren } from '../utils/hierarchy';
import { normalizeTaskStatus } from '../utils/taskStatus';
import { progressFromChecklist, summarizeChecklistByTask } from '../utils/checklistTodos';

/** Keeps a task's progress bar moving with its checklist: each checked-off
 * step nudges it forward, capped at 99% -- reaching 100/"Abgeschlossen"
 * still goes through the Definition of Done gate (completeTaskAfterDod),
 * the one place that's allowed to happen, same as every other way progress
 * can move (see updateTask's own 99% guard). Mounted once at the app root
 * so it stays live regardless of which page is open, since a checklist can
 * be ticked from the task dialog or dragged on the Kanban board alike. */
export function useChecklistProgressSync() {
  const checklistItems = useAllChecklistItems('progress-sync');
  const tasks = useProjectStore((state) => state.tasks);
  const updateTask = useProjectStore((state) => state.updateTask);

  useEffect(() => {
    const summary = summarizeChecklistByTask(checklistItems);
    for (const task of tasks) {
      if (task.type !== 'task') continue;
      // A summary task's progress is a computed rollup of its children,
      // never an authored value -- see utils/hierarchy.ts.
      if (hasChildren(tasks, task.id)) continue;
      // Once completed, only reopening the task (setTaskStatus) should
      // move it -- a checklist edited afterwards must not silently pull
      // a finished task back down.
      if (normalizeTaskStatus(task.status, task.progress) === 'completed') continue;
      const stats = summary[task.id];
      if (!stats) continue;
      const target = progressFromChecklist(stats.done, stats.total);
      if (target !== null && target !== task.progress) {
        updateTask(task.id, { progress: target });
      }
    }
  }, [checklistItems, tasks, updateTask]);
}
