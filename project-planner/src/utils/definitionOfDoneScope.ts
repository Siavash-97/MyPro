export function definitionOfDoneItemsForTask<T extends { taskId: string | null }>(
  items: T[],
  taskId: string,
): T[] {
  return items.filter((item) => item.taskId === taskId);
}
