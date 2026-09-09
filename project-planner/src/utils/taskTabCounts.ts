export interface TaskEditTabCounts {
  checklistCompleted: number;
  checklistTotal: number;
  /** The custom checklist alone, undiluted by Definition of Done items --
   * unlike checklistCompleted/Total (used for the tab label), this is what
   * decides whether a task's progress is driven by its own checklist. */
  ownChecklistCompleted: number;
  ownChecklistTotal: number;
  definitionCompleted: number;
  definitionTotal: number;
  definitionAvailable: boolean;
  comments: number;
  attachments: number;
}

export const EMPTY_TASK_TAB_COUNTS: TaskEditTabCounts = {
  checklistCompleted: 0,
  checklistTotal: 0,
  ownChecklistCompleted: 0,
  ownChecklistTotal: 0,
  definitionCompleted: 0,
  definitionTotal: 0,
  definitionAvailable: false,
  comments: 0,
  attachments: 0,
};

export function calculateTaskTabCounts(
  checklist: Array<{ done: boolean }>,
  commentCount: number,
  definitionItems: Array<{ id: string }>,
  definitionChecks: Array<{ itemId: string; done: boolean }>,
  attachmentCount: number,
  definitionAvailable = true,
): TaskEditTabCounts {
  const definitionIds = new Set(definitionItems.map((item) => item.id));
  const completedDefinitionItems = definitionChecks.filter(
    (check) => check.done && definitionIds.has(check.itemId),
  ).length;
  const ownChecklistCompleted = checklist.filter((item) => item.done).length;

  return {
    checklistCompleted: ownChecklistCompleted + completedDefinitionItems,
    checklistTotal: checklist.length + definitionItems.length,
    ownChecklistCompleted,
    ownChecklistTotal: checklist.length,
    definitionCompleted: completedDefinitionItems,
    definitionTotal: definitionItems.length,
    definitionAvailable,
    comments: commentCount,
    attachments: attachmentCount,
  };
}
