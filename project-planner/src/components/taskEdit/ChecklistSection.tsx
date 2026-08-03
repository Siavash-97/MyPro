import { useEffect, useState } from 'react';
import {
  listChecklistItems,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  subscribeChecklistItems,
  type ChecklistItem,
} from '../../lib/checklist';

/** Small abhakbare Teilschritte pro Aufgabe -- intentionally not gated by
 * isViewer, unlike the other sections here: every signed-in user (including
 * viewer-role accounts) can add, check off, and delete items. See
 * supabase-checklist-setup.sql for the matching RLS policy. */
export function ChecklistSection({ taskId }: { taskId: string }) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [checklistError, setChecklistError] = useState('');

  useEffect(() => {
    listChecklistItems(taskId).then(setChecklist);
    setNewChecklistText('');
    setChecklistError('');
    return subscribeChecklistItems(taskId, () => {
      listChecklistItems(taskId).then(setChecklist);
    });
  }, [taskId]);

  async function handleAddChecklistItem() {
    if (!newChecklistText.trim()) return;
    setAddingChecklistItem(true);
    setChecklistError('');
    const { error } = await addChecklistItem(taskId, newChecklistText);
    setAddingChecklistItem(false);
    if (error) {
      setChecklistError(error);
      return;
    }
    setNewChecklistText('');
    setChecklist(await listChecklistItems(taskId));
  }

  async function handleToggleChecklistItem(item: ChecklistItem) {
    await toggleChecklistItem(item.id, !item.done);
    setChecklist(await listChecklistItems(taskId));
  }

  async function handleDeleteChecklistItem(id: string) {
    await deleteChecklistItem(id);
    setChecklist(await listChecklistItems(taskId));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Checkliste</label>
      <p className="text-[10.5px] text-gray-400 mb-1.5">
        Kleine Teilschritte zum Abhaken -- für jeden sichtbar und von jedem nutzbar, unabhängig von Bearbeitungsrechten.
      </p>
      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-56 overflow-y-auto">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs group">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => handleToggleChecklistItem(item)}
              className="shrink-0 w-3.5 h-3.5"
            />
            <span className={`flex-1 min-w-0 truncate ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {item.text}
            </span>
            <button
              onClick={() => handleDeleteChecklistItem(item.id)}
              className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 shrink-0"
              title="Punkt entfernen"
            >
              &times;
            </button>
          </div>
        ))}
        {checklist.length === 0 && <div className="px-2.5 py-2 text-xs text-gray-400">Noch keine Punkte.</div>}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
          placeholder="Neuer Punkt…"
          value={newChecklistText}
          onChange={(e) => setNewChecklistText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddChecklistItem();
          }}
        />
        <button
          onClick={handleAddChecklistItem}
          disabled={addingChecklistItem || !newChecklistText.trim()}
          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md disabled:opacity-50"
        >
          Hinzufügen
        </button>
      </div>
      {checklistError && <p className="text-xs text-red-600 mt-1">{checklistError}</p>}
    </div>
  );
}
