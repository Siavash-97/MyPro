import type { TaskEditTabCounts } from '../../utils/taskTabCounts';

export type TaskEditTab = 'details' | 'checklist' | 'comments' | 'attachments' | 'expenses';

const CLOUD_TABS: Array<{ id: TaskEditTab; label: string }> = [
  { id: 'checklist', label: 'Checkliste' },
  { id: 'comments', label: 'Kommentare' },
  { id: 'attachments', label: 'Anhänge' },
  { id: 'expenses', label: 'Kosten' },
];

export function TaskEditTabs({
  activeTab,
  onChange,
  cloudEnabled,
  taskSaved,
  counts,
}: {
  activeTab: TaskEditTab;
  onChange: (tab: TaskEditTab) => void;
  cloudEnabled: boolean;
  taskSaved: boolean;
  counts: TaskEditTabCounts;
}) {
  const tabs = cloudEnabled ? [{ id: 'details' as const, label: 'Details' }, ...CLOUD_TABS] : [{ id: 'details' as const, label: 'Details' }];

  return (
    <nav className="px-5 border-b border-gray-100 bg-gray-50/60 flex gap-1 overflow-x-auto" aria-label="Aufgabenbereiche">
      {tabs.map((tab) => {
        const disabled = tab.id !== 'details' && !taskSaved;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            title={disabled ? 'Aufgabe zuerst speichern' : undefined}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.id === 'checklist'
              ? `${tab.label} (${counts.checklistCompleted}/${counts.checklistTotal})`
              : tab.id === 'comments'
                ? `${tab.label} (${counts.comments})`
                : tab.id === 'attachments'
                  ? `${tab.label} (${counts.attachments})`
                  : tab.label}
          </button>
        );
      })}
    </nav>
  );
}
