export function definitionOfDoneItemsForWorkPackage<T extends { workPackageId: string | null }>(
  items: T[],
  workPackageId: string | null,
): T[] {
  if (!workPackageId) return [];
  return items.filter((item) => item.workPackageId === workPackageId);
}
