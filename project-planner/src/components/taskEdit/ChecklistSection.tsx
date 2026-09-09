import { useEffect, useMemo, useState } from 'react';
import {
  listChecklistItems,
  addChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  subscribeChecklistItems,
  type ChecklistItem,
} from '../../lib/checklist';
import { progressFromChecklist } from '../../utils/checklistTodos';

function formatChecklistTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Small abhakbare Teilschritte pro Aufgabe -- intentionally not gated by
 * isViewer, unlike the other sections here: every signed-in user (including
 * viewer-role accounts) can add, check off, and delete items. See
 * supabase-checklist-setup.sql for the matching RLS policy. */
export function ChecklistSection({ taskId, title = 'Checkliste' }: { taskId: string; title?: string }) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [checklistError, setChecklistError] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');

  useEffect(() => {
    listChecklistItems(taskId).then(setChecklist);
    setNewChecklistText('');
    setChecklistError('');
    setEditingItemId(null);
    setEditingItemText('');
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

  function startEditingChecklistItem(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditingItemText(item.text);
  }

  async function handleSaveChecklistItem() {
    if (!editingItemId) return;
    setChecklistError('');
    const { error } = await updateChecklistItem(editingItemId, editingItemText);
    if (error) {
      setChecklistError(error);
      return;
    }
    setEditingItemId(null);
    setEditingItemText('');
    setChecklist(await listChecklistItems(taskId));
  }

  const completedCount = useMemo(() => checklist.filter((item) => item.done).length, [checklist]);
  const checklistProgress = progressFromChecklist(completedCount, checklist.length);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1">
        <div>
          <label className="block text-xs font-medium text-gray-500">{title}</label>
          <p className="text-[10.5px] text-gray-400 mt-0.5">
            Kleine Teilschritte zum Abhaken -- für jeden sichtbar und von jedem nutzbar, unabhängig von
            Bearbeitungsrechten.
          </p>
        </div>
        {checklist.length > 0 && checklistProgress !== null && (
          <span className="text-[10.5px] font-medium text-blue-600 shrink-0">
            {completedCount}/{checklist.length} · {checklistProgress}%
          </span>
        )}
      </div>

      {checklist.length > 0 && checklistProgress !== null && (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${checklistProgress}%` }} />
        </div>
      )}

      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-56 overflow-y-auto">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-start gap-2 px-2.5 py-1.5 text-xs group">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => handleToggleChecklistItem(item)}
              className="shrink-0 w-3.5 h-3.5 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800 truncate">{item.createdBy ?? 'Unbekannt'}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400">{formatChecklistTime(item.createdAt)}</span>
                  {editingItemId !== item.id && (
                    <span className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        onClick={() => startEditingChecklistItem(item)}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="text-gray-300 hover:text-red-600"
                        title="Punkt entfernen"
                      >
                        &times;
                      </button>
                    </span>
                  )}
                </span>
              </div>
              {editingItemId === item.id ? (
                <div className="flex gap-2 mt-1">
                  <input
                    autoFocus
                    value={editingItemText}
                    onChange={(event) => setEditingItemText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleSaveChecklistItem();
                      if (event.key === 'Escape') setEditingItemId(null);
                    }}
                    className="flex-1 min-w-0 border border-blue-300 rounded px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => void handleSaveChecklistItem()}
                    disabled={!editingItemText.trim()}
                    className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40"
                  >
                    Speichern
                  </button>
                  <button onClick={() => setEditingItemId(null)} className="text-gray-400 hover:text-gray-600">
                    Abbrechen
                  </button>
                </div>
              ) : (
                <p className={`mt-0.5 truncate ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.text}
                </p>
              )}
            </div>
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
