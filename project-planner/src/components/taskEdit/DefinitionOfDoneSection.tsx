import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDefinitionOfDoneItem,
  deleteDefinitionOfDoneItem,
  listDefinitionOfDoneItems,
  listTaskDefinitionOfDoneChecks,
  setTaskDefinitionOfDoneCheck,
  subscribeDefinitionOfDone,
  updateDefinitionOfDoneItem,
  type DefinitionOfDoneItem,
} from '../../lib/definitionOfDone';
import { definitionOfDoneItemsForTask } from '../../utils/definitionOfDoneScope';

export function DefinitionOfDoneSection({
  taskId,
  isViewer,
}: {
  taskId: string;
  isViewer: boolean;
}) {
  const [items, setItems] = useState<DefinitionOfDoneItem[]>([]);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [templateResult, checksResult] = await Promise.all([
      listDefinitionOfDoneItems(taskId),
      listTaskDefinitionOfDoneChecks(taskId),
    ]);
    setItems(definitionOfDoneItemsForTask(templateResult.items, taskId));
    setCheckedItemIds(new Set(checksResult.checks.filter((check) => check.done).map((check) => check.itemId)));
    setError(templateResult.error ?? checksResult.error ?? '');
  }, [taskId]);

  useEffect(() => {
    void refresh();
    return subscribeDefinitionOfDone(taskId, () => void refresh());
  }, [taskId, refresh]);

  const completedCount = useMemo(
    () => items.filter((item) => checkedItemIds.has(item.id)).length,
    [items, checkedItemIds],
  );
  const completionPercent = items.length ? Math.round((completedCount / items.length) * 100) : 0;

  async function handleToggle(item: DefinitionOfDoneItem) {
    const nextDone = !checkedItemIds.has(item.id);
    setBusyItemId(item.id);
    setError('');
    const result = await setTaskDefinitionOfDoneCheck(taskId, item.id, nextDone);
    setBusyItemId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return;
    setSavingTemplate(true);
    setError('');
    const result = await addDefinitionOfDoneItem(taskId, newItemText);
    setSavingTemplate(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewItemText('');
    await refresh();
  }

  function startEditing(item: DefinitionOfDoneItem) {
    setEditingItemId(item.id);
    setEditingText(item.text);
  }

  async function handleSaveEdit() {
    if (!editingItemId) return;
    setSavingTemplate(true);
    setError('');
    const result = await updateDefinitionOfDoneItem(editingItemId, editingText);
    setSavingTemplate(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingItemId(null);
    setEditingText('');
    await refresh();
  }

  async function handleDelete(item: DefinitionOfDoneItem) {
    if (!confirm(`DoD-Punkt "${item.text}" wirklich aus dieser Aufgabe löschen?`)) return;
    setBusyItemId(item.id);
    setError('');
    const result = await deleteDefinitionOfDoneItem(item.id);
    setBusyItemId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  const schemaMissing = /planner_dod_items|planner_task_dod_checks|schema cache/i.test(error);

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-1">
        <div>
          <h3 className="text-xs font-medium text-gray-600">Definition of Done</h3>
          <p className="text-[10.5px] text-gray-400 mt-0.5">
            Diese Liste gehört nur zu dieser Aufgabe. Änderungen wirken sich nicht auf andere Aufgaben aus.
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-[10.5px] font-medium text-gray-500 shrink-0">
            {completedCount}/{items.length} · {completionPercent}%
          </span>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${completionPercent}%` }} />
      </div>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {items.map((item) => {
          const done = checkedItemIds.has(item.id);
          const editing = editingItemId === item.id;
          return (
            <div key={item.id} className="flex items-center gap-2 px-2.5 py-2 text-xs group">
              <input
                type="checkbox"
                checked={done}
                disabled={busyItemId === item.id}
                onChange={() => handleToggle(item)}
                className="shrink-0 w-3.5 h-3.5"
              />
              {editing ? (
                <input
                  autoFocus
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSaveEdit();
                    if (event.key === 'Escape') setEditingItemId(null);
                  }}
                  className="flex-1 min-w-0 border border-blue-300 rounded px-2 py-1 text-xs"
                />
              ) : (
                <span className={`flex-1 min-w-0 ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.text}
                </span>
              )}

              {!isViewer && editing && (
                <>
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={savingTemplate || !editingText.trim()}
                    className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40"
                  >
                    Speichern
                  </button>
                  <button onClick={() => setEditingItemId(null)} className="text-gray-400 hover:text-gray-600">
                    Abbrechen
                  </button>
                </>
              )}

              {!isViewer && !editing && (
                <span className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0">
                  <button onClick={() => startEditing(item)} className="text-gray-400 hover:text-blue-600">
                    Bearbeiten
                  </button>
                  <button onClick={() => void handleDelete(item)} className="text-gray-400 hover:text-red-600">
                    Löschen
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {items.length === 0 && !error && (
          <div className="px-2.5 py-3 text-xs text-gray-400 text-center">Noch keine DoD-Punkte vorhanden.</div>
        )}
      </div>

      {!isViewer && !schemaMissing && (
        <div className="flex gap-2 mt-2">
          <input
            value={newItemText}
            onChange={(event) => setNewItemText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleAddItem();
            }}
            placeholder="Neuen DoD-Punkt nur für diese Aufgabe hinzufügen…"
            className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
          />
          <button
            onClick={() => void handleAddItem()}
            disabled={savingTemplate || !newItemText.trim()}
            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-2 mt-2">
          {schemaMissing
            ? 'Definition of Done ist in der Datenbank noch nicht eingerichtet. Bitte einmal supabase-definition-of-done-setup.sql im Supabase SQL Editor ausführen.'
            : error}
        </p>
      )}
    </section>
  );
}
