import { ChecklistSection } from './ChecklistSection';
import { DefinitionOfDoneSection } from './DefinitionOfDoneSection';

export function TaskChecklistTab({ taskId, isViewer }: { taskId: string; isViewer: boolean }) {
  return (
    <div className="space-y-6">
      <ChecklistSection taskId={taskId} title="Aufgaben-Checkliste" />
      <DefinitionOfDoneSection taskId={taskId} isViewer={isViewer} />
    </div>
  );
}
