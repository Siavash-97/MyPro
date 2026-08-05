import { ChecklistSection } from './ChecklistSection';
import { DefinitionOfDoneSection } from './DefinitionOfDoneSection';

export function TaskChecklistTab({
  taskId,
  workPackageId,
  workPackageName,
  isViewer,
}: {
  taskId: string;
  workPackageId: string | null;
  workPackageName: string | null;
  isViewer: boolean;
}) {
  return (
    <div className="space-y-6">
      <ChecklistSection taskId={taskId} title="Aufgaben-Checkliste" />
      <DefinitionOfDoneSection
        taskId={taskId}
        workPackageId={workPackageId}
        workPackageName={workPackageName}
        isViewer={isViewer}
      />
    </div>
  );
}
