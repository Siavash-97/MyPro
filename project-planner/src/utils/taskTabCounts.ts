export interface TaskEditTabCounts {
  checklistCompleted: number;
  checklistTotal: number;
  comments: number;
  attachments: number;
}

export const EMPTY_TASK_TAB_COUNTS: TaskEditTabCounts = {
  checklistCompleted: 0,
  checklistTotal: 0,
  comments: 0,
  attachments: 0,
};

export function calculateTaskTabCounts(
  checklist: Array<{ done: boolean }>,
  commentCount: number,
  definitionItems: Array<{ id: string }>,
  definitionChecks: Array<{ itemId: string; done: boolean }>,
  attachmentCount: number,
): TaskEditTabCounts {
  const definitionIds = new Set(definitionItems.map((item) => item.id));
  const completedDefinitionItems = definitionChecks.filter(
    (check) => check.done && definitionIds.has(check.itemId),
  ).length;

  return {
    checklistCompleted: checklist.filter((item) => item.done).length + completedDefinitionItems,
    checklistTotal: checklist.length + definitionItems.length,
    comments: commentCount,
    attachments: attachmentCount,
  };
}
